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
  try {
    await auth.verifyIdToken(header.slice(7));
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── Validate body ──
  const { toUserId, title, body, data } = req.body ?? {};
  if (!toUserId || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields: toUserId, title, body' });
  }

  try {
    // ── Fetch target user from Firestore ──
    const snap = await db.collection('users').doc(toUserId).get();
    if (!snap.exists) {
      return res.status(200).json({ sent: false, reason: 'User not found' });
    }

    const userData = snap.data();
    const token    = userData?.fcmToken;
    const lang     = userData?.lang ?? 'ar';

    if (!token || !Expo.isExpoPushToken(token)) {
      return res.status(200).json({ sent: false, reason: 'No valid Expo push token' });
    }

    // ── Build and send the push message ──
    const message = {
      to:       token,
      sound:    'default',
      title:    pickLang(title, lang),
      body:     pickLang(body,  lang),
      data:     data ?? {},
      priority: 'high',
    };

    const [ticket] = await expo.sendPushNotificationsAsync([message]);

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
