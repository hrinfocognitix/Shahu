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

const uploadFile = asyncHandler(async (req, res) =>
  apiResponse.success(res, {
    message: 'File uploaded',
    data: req.file
      ? { ...req.file, url: `/uploads/${req.file.filename}` }
      : (() => {
          const error = new Error('No file received. Please attach an image or video file.');
          error.statusCode = 400;
          throw error;
        })()
  })
);

module.exports = { health, uploadFile };
