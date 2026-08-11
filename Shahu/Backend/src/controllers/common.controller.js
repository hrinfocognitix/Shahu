const sharp = require('sharp');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const { MESSAGES } = require('../constants/messages');
const { uploadBuffer } = require('../services/cloudinary.service');

const health = asyncHandler(async (req, res) =>
  apiResponse.success(res, { message: MESSAGES.HEALTH_OK, data: { uptime: process.uptime(), timestamp: new Date().toISOString() } })
);

const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    const error = new Error('No file received. Please attach an image or video file.');
    error.statusCode = 400;
    throw error;
  }
  if (req.file.mimetype.startsWith('image/')) {
    try { await sharp(req.file.buffer).metadata(); }
    catch {
      const error = new Error('The uploaded image is invalid or corrupted');
      error.statusCode = 400;
      throw error;
    }
  }
  const result = await uploadBuffer(req.file, { folder: 'shahu-academy/common' });
  return apiResponse.success(res, {
    message: 'File uploaded',
    data: {
      filename: result.public_id,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      public_id: result.public_id,
      secure_url: result.secure_url,
      url: result.secure_url,
    }
  });
});

module.exports = { health, uploadFile };
