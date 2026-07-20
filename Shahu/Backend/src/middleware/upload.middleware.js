const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename(req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.heic', '.heif', '.bmp', '.tif', '.tiff']);
const videoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']);
const videoExtensions = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const documentTypeExtensions = new Map([
  ['application/pdf', new Set(['.pdf'])],
  ['application/msword', new Set(['.doc'])],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', new Set(['.docx'])],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Set(['.xlsx'])],
]);

function accepted(file, mediaOnly) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const image = file.mimetype.startsWith('image/') && imageExtensions.has(extension);
  const video = videoTypes.has(file.mimetype) && videoExtensions.has(extension);
  if (image || video) return true;
  if (mediaOnly) return false;
  return documentTypeExtensions.get(file.mimetype)?.has(extension) || false;
}

const createUpload = (mediaOnly = false) => multer({
  storage,
  fileFilter(req, file, cb) {
    if (!accepted(file, mediaOnly)) {
      return cb(new Error(mediaOnly
        ? 'Select a supported image or MP4, WebM, MOV, or M4V video'
        : 'Select an image, supported video, PDF, DOC, DOCX, or XLSX file'));
    }
    return cb(null, true);
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});

const upload = createUpload(false);
upload.media = createUpload(true);
upload._internals = { accepted };

module.exports = upload;
