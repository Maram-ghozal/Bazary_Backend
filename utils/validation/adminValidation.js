const Joi = require("joi");

const updateAdminProfileSchema = Joi.object({
  fullName: Joi.string().min(3).max(50),
  phone: Joi.string().trim().pattern(/^[0-9+\-\s()]+$/),
});

module.exports = { updateAdminProfileSchema };