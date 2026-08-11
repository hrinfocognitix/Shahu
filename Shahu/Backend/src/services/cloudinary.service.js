const { cloudinary, isConfigured } = require('../config/cloudinary');
const logger = require('../config/logger');

function requireConfiguration() {
  if (!isConfigured()) {
    const error = new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
    error.statusCode = 503;
    throw error;
  }
}

function uploadBuffer(file, { folder = 'shahu-academy' } = {}) {
  requireConfiguration();
  if (!file?.buffer?.length) {
    const error = new Error('No upload data received');
    error.statusCode = 400;
    throw error;
  }
  const imageUpload = file.mimetype?.startsWith('image/');
  const metadata = {
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    size: file.size || file.buffer.length,
    folder,
  };
  if (imageUpload) logger.info('Image upload started', metadata);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', use_filename: false },
      (error, result) => {
        if (!error) {
          if (imageUpload) {
            logger.info('Image upload completed', {
              ...metadata,
              publicId: result.public_id,
              resourceType: result.resource_type,
              bytes: result.bytes,
            });
          }
          return resolve(result);
        }
        // Cloudinary errors use http_code instead of Express's statusCode.
        error.statusCode = error.http_code || 502;
        error.message = `Cloudinary upload failed: ${error.message || 'Unknown Cloudinary error'}`;
        if (imageUpload) logger.error('Image upload failed', { ...metadata, statusCode: error.statusCode, error: error.message });
        return reject(error);
      }
    );
    stream.end(file.buffer);
  });
}

async function destroyAsset(publicId, resourceType = 'image') {
  if (!publicId || !isConfigured()) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
}

module.exports = { uploadBuffer, destroyAsset };
