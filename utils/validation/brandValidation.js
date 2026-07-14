const Joi = require("joi");

const createBrandSchema = Joi.object({
  firstName: Joi.string().trim().min(3).required(),
  lastName: Joi.string().trim().min(3).required(),
  phone: Joi.string().trim().pattern(/^[0-9+\-\s()]+$/).required(),
  whatsapp: Joi.string().trim().pattern(/^[0-9+\-\s()]+$/).allow("").optional(),
  email: Joi.string().email().lowercase().required(),
  logoUrl: Joi.string().uri().optional(),
  backgroundImage: Joi.string().uri().optional(),
  brandType: Joi.string().valid("OFFLINE", "ONLINE", "HYBRID").required(),
  brandName: Joi.string().trim().min(3).required(),
  brandCategory: Joi.string().trim().min(2).optional(),
  brandDescription: Joi.string().min(10).max(600).optional(),
  location: Joi.string().trim().allow("").optional(),
  socialMediaLinks: Joi.array().items(Joi.string().uri()).optional()
});

const updateBrandSchema = Joi.object({
  firstName: Joi.string().trim().min(3),
  lastName: Joi.string().trim().min(3),
  phone: Joi.string().trim().pattern(/^[0-9+\-\s()]+$/),
  whatsapp: Joi.string().trim().pattern(/^[0-9+\-\s()]+$/).allow(""),
  logoUrl: Joi.string().uri(),
  backgroundImage: Joi.string().uri(),
  brandName: Joi.string().trim().min(3),
  brandCategory: Joi.string().trim().min(2),
  brandDescription: Joi.string().trim().min(10).max(600),
  location: Joi.string().trim().allow(""),
  socialMediaLinks: Joi.array().items(Joi.string().uri()).optional()
}).min(1);

const blockBrandSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required().messages({
    "string.empty": "Block reason is required",
    "any.required": "Block reason is required",
  }),
});

module.exports = { createBrandSchema, updateBrandSchema, blockBrandSchema };