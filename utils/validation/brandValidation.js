const Joi = require('joi');

const createBrandSchema = Joi.object({
  bazaarId:         Joi.string().hex().length(24).required(),
  firstName:        Joi.string().trim().min(3).required(),
  lastName:         Joi.string().trim().min(3).required(),
  phone:            Joi.string().trim().required(),
  whatsapp:         Joi.string().trim().allow('').optional(),
  email:            Joi.string().email().lowercase().required(),
  brandName:        Joi.string().trim().min(3).required(),
  brandCategory:    Joi.string().trim().min(2).optional(),
  brandDescription: Joi.string().min(10).max(600).optional(),
  location:         Joi.string().optional(),
  // joinType بيتبعت مع الـ payment step
  joinType: Joi.string().valid('OFFLINE', 'ONLINE', 'HYBRID').required(),
});

const updateBrandSchema = Joi.object({
  firstName:        Joi.string().trim(),
  lastName:         Joi.string().trim(),
  phone:            Joi.string().trim(),
  whatsapp:         Joi.string().trim().allow(''),
  brandName:        Joi.string().trim(),
  brandCategory:    Joi.string().trim(),
  brandDescription: Joi.string().max(500),
  location:         Joi.string().allow(''),
}).min(1); // At least one field must be provided

module.exports = { createBrandSchema, updateBrandSchema };