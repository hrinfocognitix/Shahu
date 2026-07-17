const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');

const validate = schema => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return next(
      new AppError(
        'Validation failed',
        STATUS_CODES.BAD_REQUEST,
        error.details.map(item => item.message)
      )
    );
  }

  req.body = value;
  return next();
};

module.exports = validate;
