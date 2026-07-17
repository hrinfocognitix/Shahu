const pick = (object, keys) =>
  keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      acc[key] = object[key];
    }
    return acc;
  }, {});

module.exports = { pick };
