// One-time script: uploads all exercise videos to Cloudinary
// Run: node scripts/upload-videos.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = path.join(__dirname, '..', 'assets', 'videos');

const CLOUD_NAME    = 'dyrf3eqtn';
const UPLOAD_PRESET = 'Haraka_App';

const VIDEO_MAP = {
  wristCurls:               'first.mp4',
  childsPose:               '2.mp4',
  warriorTwo:               '3.mp4',
  jabPunches:               '4.mp4',
  comboPunches:             '5.mp4',
  singleLegStand:           '6.mp4',
  armBottles:               '7.mp4',
  seatedEndurance:          '8.mp4',
  neckFlexibility:          '9.mp4',
  standUpStrength:          '10.mp4',
  upperBodyStretch:         '11.mp4',
  marchingInPlace:          '12.mp4',
  chairSquat:               '13.mp4',
  hipStrength:              '14.mp4',
  seatedTwistKnee:          '15.mp4',
  armLegStrength:           '16.mp4',
  standingArmTrunk:         '17.mp4',
  lyingTwistArms:           '18.mp4',
  backBridgeLying:          '19.mp4',
  upperFlexArmStrength:     '20.mp4',
  trunkBackFlexibility:     '21.mp4',
  towelArmStrength:         '22.mp4',
  seatedBicycle:            '23.mp4',
  heelTapStanding:          '24.mp4',
  kneeCircleStanding:       '25.mp4',
  legSwingBalance:          '26.mp4',
  pelvisTiltSeated:         '27.mp4',
  trunkRotationStanding:    '28.mp4',
  lateralBalanceSeated:     '29.mp4',
  toeTipHeelStand:          '30.mp4',
  trunkFlexibilityStanding: '31.mp4',
};

function uploadToCloudinary(filePath, fileName) {
  return new Promise((resolve, reject) => {
    const fileData = readFileSync(filePath);
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

    const fieldPart = (name, value) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;

    const header = Buffer.from(
      fieldPart('upload_preset', UPLOAD_PRESET) +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: video/mp4\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileData, footer]);

    const options = {
      hostname: 'api.cloudinary.com',
      // auto/upload auto-detects resource type (works for images AND video)
      path: `/v1_1/${CLOUD_NAME}/auto/upload`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.secure_url) resolve(json.secure_url);
          else reject(new Error(json.error?.message ?? `HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        } catch (e) {
          reject(new Error(`Parse error (HTTP ${res.statusCode}): ${data.slice(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const results = {};
  const entries = Object.entries(VIDEO_MAP);
  console.log(`Uploading ${entries.length} videos to Cloudinary (auto/upload)...\n`);

  for (const [key, file] of entries) {
    const filePath = path.join(VIDEOS_DIR, file);
    process.stdout.write(`  [${key}] ${file} ... `);
    try {
      const url = await uploadToCloudinary(filePath, file);
      results[key] = url;
      console.log(`✅  ${url.slice(0, 60)}...`);
    } catch (e) {
      console.log(`❌  ${e.message}`);
      results[key] = null;
    }
  }

  const failed = Object.values(results).filter(v => !v).length;
  console.log(`\n\nDone. ${entries.length - failed}/${entries.length} uploaded.`);
  if (failed > 0) console.log('Re-run the script to retry failed uploads.\n');

  console.log('\n// ── Paste this block into Exercisesessionscreen.tsx (replace the EXERCISE_VIDEOS const) ──');
  console.log('const EXERCISE_VIDEOS: Record<string, any> = {');
  for (const [key, url] of Object.entries(results)) {
    if (url) console.log(`  ${key}: { uri: '${url}' },`);
    else      console.log(`  ${key}: null, // UPLOAD FAILED`);
  }
  console.log('};');
}

main().catch(console.error);
