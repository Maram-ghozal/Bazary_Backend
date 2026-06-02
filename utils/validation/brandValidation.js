const Joi = require("joi");

const createBrandSchema = Joi.object({
  firstName: Joi.string().trim().min(3).required(),
  lastName: Joi.string().trim().min(3).required(),
  phone: Joi.string().trim().pattern(/^[0-9+\-\s()]+$/).required(),
  whatsapp: Joi.string().trim().pattern(/^[0-9+\-\s()]+$/).allow('').optional(),
  brandName: Joi.string().trim().min(3).required(),
  brandCategory: Joi.string().trim().min(2),
  brandDescription: Joi.string().trim().min(10).max(600).optional(),
  location: Joi.string().trim().allow('').optional(),
});

const updateBrandSchema = Joi.object({
  firstName: Joi.string().trim().min(3),
  lastName: Joi.string().trim().min(3),
  phone: Joi.string().trim().pattern(/^[0-9+\-\s()]+$/),
  whatsapp: Joi.string().trim().pattern(/^[0-9+\-\s()]+$/).allow(""),
  brandName: Joi.string().trim().min(3),
  brandCategory: Joi.string().trim().min(2),
  brandDescription: Joi.string().trim().min(10).max(600),
  location: Joi.string().trim().allow(''),
}).min(1); // At least one field must be provided

module.exports = { createBrandSchema, updateBrandSchema };
