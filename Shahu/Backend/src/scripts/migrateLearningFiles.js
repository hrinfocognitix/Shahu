const path = require('path');
const fs = require('fs/promises');
const { uploadDir } = require('../config/storage');
const connectDatabase = require('../config/db');
const Content = require('../models/Content');
const LearningFile = require('../models/LearningFile');
const mongoose = require('mongoose');
const apply = process.argv.includes('--apply');
async function run() {
  await connectDatabase();
  const records = await Content.find({
    type: { $in: ['note', 'material'] },
    isDeleted: { $ne: true },
    course: { $ne: null },
    subject: { $ne: null },
  });
  let migrated = 0;
  for (const record of records) {
    if (await LearningFile.exists({ legacyContent: record._id })) continue;
    const url = record.resourceUrl || record.externalUrl;
    if (!url) continue;
    const storedFilename = path.basename(url);
    let fileSize = 0;
    try {
      fileSize = (await fs.stat(path.join(uploadDir, storedFilename))).size;
    } catch {
      fileSize = 0;
    }
    const extension = path.extname(storedFilename).toLowerCase();
    const mimeType =
      extension === '.pdf'
        ? 'application/pdf'
        : extension === '.doc'
          ? 'application/msword'
          : extension === '.docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : record.fileType || 'application/octet-stream';
    if (apply)
      await LearningFile.create({
        course: record.course,
        subject: record.subject,
        title: record.title,
        description: record.description,
        category: record.type === 'note' ? 'notes' : 'other',
        originalFilename: storedFilename,
        storedFilename,
        fileUrl: url,
        mimeType,
        fileSize,
        status: record.status === 'published' ? 'published' : 'draft',
        legacyContent: record._id,
        createdBy: record.uploadedBy,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    migrated += 1;
  }
  console.log(
    `${apply ? 'Migrated' : 'Would migrate'} ${migrated} learning files; historical Content records are preserved.`
  );
  if (!apply) console.log('Dry run only. Re-run with --apply after reviewing this count.');
  await mongoose.disconnect();
}
run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
