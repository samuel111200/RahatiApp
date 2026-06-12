// api/send-push.js
// Vercel serverless function — sends Expo push notifications via Firebase Admin SDK

const { Expo } = require('expo-server-sdk');
const admin    = require('firebase-admin');

// ── Firebase Admin (initialises once per cold start, reused on warm invocations) ──
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db   = admin.firestore();
const auth = admin.auth();
const expo = new Expo();

// ── Helpers ────────────────────────────────────────────────────────────────────
function pickLang(val, lang) {
  if (typeof val === 'string') return val;
  return lang === 'en' ? (val.en ?? val.ar) : (val.ar ?? val.en);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth: verify the caller's Firebase ID token ──
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  let callerUid;
  try {
    const decoded = await auth.verifyIdToken(header.slice(7));
    callerUid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── Validate body ──
  const { toUserId, title, body, data } = req.body ?? {};
  if (!toUserId || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields: toUserId, title, body' });
  }

  try {
    // ── Fetch sender (photoUrl) and target (token/lang/platform) in parallel ──
    const [senderSnap, targetSnap] = await Promise.all([
      db.collection('users').doc(callerUid).get(),
      db.collection('users').doc(toUserId).get(),
    ]);

    if (!targetSnap.exists) {
      return res.status(404).json({ sent: false, reason: 'User not found' });
    }

    const senderData    = senderSnap.exists ? senderSnap.data() : {};
    const targetData    = targetSnap.data();

    const senderPhoto   = senderData?.photoUrl ?? null;
    const token         = targetData?.fcmToken;
    const expoPushToken = targetData?.expoPushToken;
    const lang          = targetData?.lang ?? 'ar';
    const platform      = targetData?.devicePlatform ?? 'android';

    const titleStr = pickLang(title, lang);
    const bodyStr  = pickLang(body,  lang);

    // ── Android + native FCM token → Admin SDK (supports sender avatar via imageUrl) ──
    const isNativeFcm = token && platform === 'android' && !token.startsWith('ExponentPushToken');

    if (isNativeFcm) {
      // Admin SDK requires all data values to be strings
      const fcmData = Object.fromEntries(
        Object.entries(data ?? {}).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)])
      );
      const message = {
        token,
        notification: {
          title: titleStr,
          body:  bodyStr,
          ...(senderPhoto && { imageUrl: senderPhoto }),
        },
        android: {
          notification: {
            channelId: 'chat',
            color:     '#7C5CBF',
            ...(senderPhoto && { imageUrl: senderPhoto }),
          },
        },
        data: fcmData,
      };
      try {
        const msgId = await admin.messaging().send(message);
        return res.status(200).json({ sent: true, messageId: msgId });
      } catch (err) {
        console.error('[send-push] FCM send error:', err.message ?? err);
        // Fall through to Expo push service as fallback
      }
    }

    // ── Expo push service fallback (iOS / Expo push tokens / FCM fallback) ──
    const expoToken = expoPushToken ?? token;
    if (!expoToken || !Expo.isExpoPushToken(expoToken)) {
      return res.status(422).json({ sent: false, reason: 'No valid Expo push token' });
    }

    const expoMessage = {
      to:        expoToken,
      sound:     'default',
      title:     titleStr,
      body:      bodyStr,
      data:      data ?? {},
      priority:  'high',
      channelId: 'chat',
    };

    const [ticket] = await expo.sendPushNotificationsAsync([expoMessage]);

    if (ticket.status === 'error') {
      console.error('[send-push] Expo ticket error:', ticket.message, ticket.details);
      return res.status(200).json({ sent: false, reason: ticket.message });
    }

    return res.status(200).json({ sent: true, ticket });
  } catch (err) {
    console.error('[send-push] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
