const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Render's application filesystem is ephemeral. In production set UPLOAD_DIR
// to the mount path of a Render persistent disk (for example /var/data/uploads).
// Local development continues to use src/uploads without extra setup.
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));

fs.mkdirSync(uploadDir, { recursive: true });

const defaultCoursePoster = path.join(uploadDir, 'course-default-poster.png');

// `src/uploads` is deliberately not committed because it holds user uploads.
// On Render, a persistent UPLOAD_DIR therefore starts empty. Create the one
// application-owned fallback poster there so courses without a custom image
// never produce a /uploads/course-default-poster.png 404.
const ensureDefaultCoursePoster = async () => {
  try {
    await fs.promises.access(defaultCoursePoster, fs.constants.R_OK);
    return;
  } catch {
    // The poster will be created below.
  }

  const svg = `
    <svg width="1024" height="1536" viewBox="0 0 1024 1536" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#075f5a"/>
          <stop offset="1" stop-color="#023b38"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1536" fill="url(#background)"/>
      <circle cx="900" cy="170" r="260" fill="#f4b942" fill-opacity=".17"/>
      <circle cx="80" cy="1360" r="300" fill="#ffffff" fill-opacity=".08"/>
      <text x="512" y="660" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="76" font-weight="700">SHAHU</text>
      <text x="512" y="750" text-anchor="middle" fill="#f7d26a" font-family="Arial, sans-serif" font-size="64" font-weight="700">ACADEMY</text>
      <rect x="330" y="805" width="364" height="4" rx="2" fill="#f7d26a"/>
      <text x="512" y="880" text-anchor="middle" fill="#e7f5f4" font-family="Arial, sans-serif" font-size="30">LEARN • GROW • ACHIEVE</text>
    </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(defaultCoursePoster);
};

module.exports = { uploadDir, ensureDefaultCoursePoster };
