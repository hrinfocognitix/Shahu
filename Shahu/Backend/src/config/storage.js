const fs = require('fs');
const path = require('path');

// Render's application filesystem is ephemeral. In production set UPLOAD_DIR
// to the mount path of a Render persistent disk (for example /var/data/uploads).
// Local development continues to use src/uploads without extra setup.
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));

fs.mkdirSync(uploadDir, { recursive: true });

module.exports = { uploadDir };
