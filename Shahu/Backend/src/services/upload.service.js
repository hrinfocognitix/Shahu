const path = require('path');
const sharp = require('sharp');

async function compressImage(file) {
  if (!file?.mimetype?.startsWith('image/')) {
    return file;
  }

  const outputPath = path.join(
    path.dirname(file.path),
    `${path.parse(file.filename).name}-compressed.webp`
  );
  await sharp(file.path).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(outputPath);
  return {
    ...file,
    compressedPath: outputPath
  };
}

module.exports = { compressImage };
