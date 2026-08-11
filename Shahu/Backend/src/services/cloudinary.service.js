const { cloudinary, isConfigured } = require('../config/cloudinary');

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
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', use_filename: false },
      (error, result) => error ? reject(error) : resolve(result)
    );
    stream.end(file.buffer);
  });
}

async function destroyAsset(publicId, resourceType = 'image') {
  if (!publicId || !isConfigured()) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
}

module.exports = { uploadBuffer, destroyAsset };
