const { v2: cloudinary } = require('cloudinary');

// Cloudinary also supports the single CLOUDINARY_URL variable. Accept it for
// existing Render setups while documenting the three explicit secrets.
const credentials = (() => {
  if (process.env.CLOUDINARY_URL) {
    const url = new URL(process.env.CLOUDINARY_URL);
    return {
      cloud_name: url.hostname,
      api_key: decodeURIComponent(url.username),
      api_secret: decodeURIComponent(url.password),
      secure: true,
    };
  }
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  };
})();

cloudinary.config(credentials);

function isConfigured() {
  const configured = cloudinary.config();
  return Boolean(configured.cloud_name && configured.api_key && configured.api_secret);
}

module.exports = { cloudinary, isConfigured };
