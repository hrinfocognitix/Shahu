const Joi = require('joi');

const createAdminSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().trim().lowercase().email().required(),
});

const updateAdminSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80),
  isActive: Joi.boolean(),
}).min(1).unknown(false);

module.exports = { createAdminSchema, updateAdminSchema };
