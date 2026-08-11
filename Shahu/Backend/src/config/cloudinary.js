const { v2: cloudinary } = require('cloudinary');

const credentials = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
};

cloudinary.config(credentials);

function isConfigured() {
  return Boolean(credentials.cloud_name && credentials.api_key && credentials.api_secret);
}

module.exports = { cloudinary, isConfigured };
