const Subject = require('../models/Subject');

async function allowDuplicateSubjectNames() {
  const indexes = await Subject.collection.indexes();
  const uniqueNameIndex = indexes.find(
    (index) => index.unique && Object.keys(index.key).length === 1 && index.key.name === 1
  );

  if (uniqueNameIndex) {
    await Subject.collection.dropIndex(uniqueNameIndex.name);
  }
}

module.exports = { allowDuplicateSubjectNames };
