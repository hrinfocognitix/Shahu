const path = require('path');
const multer = require('multer');
// Render's filesystem is ephemeral. Keep the upload only for the lifetime of
// the request; controllers stream the buffer to Cloudinary.
const storage = multer.memoryStorage();

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
  // Some browsers report an XLSX upload as application/octet-stream. The
  // question importer verifies the workbook itself, so accept the extension
  // here instead of rejecting a valid Excel file before it reaches it.
  if (['.xlsx', '.csv'].includes(extension)) return true;
  return documentTypeExtensions.get(file.mimetype)?.has(extension) || false;
}

const createUpload = (mediaOnly = false) => multer({
  storage,
  fileFilter(req, file, cb) {
    // Multer rejects unsupported files before the controller runs. Preserve
    // only non-sensitive metadata so the request-completion log can explain
    // why an upload (especially a mock-test spreadsheet) was refused.
    req.uploadAttempt = {
      field: file.fieldname,
      name: file.originalname,
      extension: path.extname(file.originalname || '').toLowerCase(),
      mimeType: file.mimetype,
      mediaOnly,
    };
    if (!accepted(file, mediaOnly)) {
      const isLegacyExcel = path.extname(file.originalname || '').toLowerCase() === '.xls';
      return cb(new Error(mediaOnly
        ? 'Select a supported image or MP4, WebM, MOV, or M4V video'
        : isLegacyExcel
          ? 'The older .xls Excel format is not supported. Open it in Excel or Numbers and save/export it as .xlsx or .csv, then upload again.'
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
