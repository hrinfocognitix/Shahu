const mongoose = require('mongoose');
const connectDatabase = require('../config/db');
const Question = require('../models/Question');

const apply = process.argv.includes('--apply');
const signature = (options = []) => {
  const byKey = Object.fromEntries(options.map((option) => [option.key, option.text]));
  return ['A', 'B', 'C', 'D']
    .map((key) => String(byKey[key] || '').trim().replace(/\s+/g, ' ').toLowerCase())
    .join('\u001f');
};

async function run() {
  await connectDatabase();
  const questions = await Question.find({ normalizedOptions: { $exists: false } }).select('_id options').lean();
  if (apply && questions.length) {
    await Question.bulkWrite(questions.map((question) => ({
      updateOne: { filter: { _id: question._id }, update: { $set: { normalizedOptions: signature(question.options) } } },
    })));
  }
  if (apply) {
    const collection = Question.collection;
    const indexes = await collection.indexes();
    const oldIndex = indexes.find((index) => index.name === 'course_1_subject_1_normalizedText_1');
    if (oldIndex) await collection.dropIndex(oldIndex.name);
    await collection.createIndex(
      { course: 1, subject: 1, normalizedText: 1, normalizedOptions: 1 },
      { unique: true, name: 'course_1_subject_1_normalizedText_1_normalizedOptions_1' },
    );
  }
  console.log(`${apply ? 'Migrated' : 'Would migrate'} ${questions.length} question option signature(s).`);
  if (!apply) console.log('Dry run only. Re-run with --apply during deployment to update the unique index.');
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
