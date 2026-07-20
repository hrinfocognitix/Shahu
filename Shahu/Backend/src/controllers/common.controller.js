const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const { MESSAGES } = require('../constants/messages');

const health = asyncHandler(async (req, res) =>
  apiResponse.success(res, {
    message: MESSAGES.HEALTH_OK,
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  })
);

const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    const error = new Error('No file received. Please attach an image or video file.');
    error.statusCode = 400;
    throw error;
  }

  let uploadedFile = req.file;
  try {
    const webImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
    if (uploadedFile.mimetype.startsWith('image/')) {
      await sharp(uploadedFile.path).metadata();
    }
    if (uploadedFile.mimetype.startsWith('image/') && !webImageTypes.has(uploadedFile.mimetype)) {
      const parsedName = path.parse(uploadedFile.filename);
      const convertedFilename = `${parsedName.name}.webp`;
      const convertedPath = path.join(uploadedFile.destination, convertedFilename);
      await sharp(uploadedFile.path).rotate().webp({ quality: 88 }).toFile(convertedPath);
      await fs.unlink(uploadedFile.path);
      const convertedStats = await fs.stat(convertedPath);
      uploadedFile = {
        ...uploadedFile, filename: convertedFilename, path: convertedPath,
        mimetype: 'image/webp', size: convertedStats.size
      };
    }
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => undefined);
    error.statusCode = 400;
    error.message = 'The uploaded image is invalid or corrupted';
    throw error;
  }

  return apiResponse.success(res, {
    message: 'File uploaded',
    data: { ...uploadedFile, url: `/uploads/${uploadedFile.filename}` }
  });
});

module.exports = { health, uploadFile };
