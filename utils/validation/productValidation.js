const Joi = require('joi');

const createProductSchema = Joi.object({
  name:            Joi.string().trim().required(),
  description:     Joi.string().optional().allow(''),
  quantity:        Joi.number().integer().min(0).required(),
  price:           Joi.number().positive().required(),
  priceAfterOffer: Joi.number().positive().optional().allow(null),
}).custom((value, helpers) => {
  const { price, priceAfterOffer } = value;
  if (priceAfterOffer && price && priceAfterOffer >= price) {
    return helpers.error('any.invalid');
  }
  return value;
});

const updateProductSchema = Joi.object({
  name: Joi.string().trim(),
  description: Joi.string().allow(''),
  quantity: Joi.number().integer().min(0),
  price: Joi.number().positive(),
  priceAfterOffer: Joi.number().positive().allow(null),
  isActive: Joi.boolean(),
}).min(1).custom((value, helpers) => {
    const { price, priceAfterOffer } = value;
    if ( priceAfterOffer !== undefined && price !== undefined) {
      if (priceAfterOffer >= price) {
        return helpers.message('priceAfterOffer must be less than price');
      }
    }
    return value;
  });

module.exports = { createProductSchema, updateProductSchema };