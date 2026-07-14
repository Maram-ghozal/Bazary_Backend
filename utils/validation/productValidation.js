const Joi = require("joi");

const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).required(),
  description: Joi.string().trim().min(10).optional().allow(""),
  quantity: Joi.number().integer().min(0).required(),
  price: Joi.number().positive().required(),
  priceAfterOffer: Joi.number().positive().optional().allow(null),
}).custom((value, helpers) => {
  const { price, priceAfterOffer } = value;
  if  (priceAfterOffer !== null && priceAfterOffer !== undefined && priceAfterOffer >= price) {
    return helpers.message("priceAfterOffer must be less than price");
  }
  return value;
});

const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2),
  description: Joi.string().trim().min(10).allow(""),
  quantity: Joi.number().integer().min(0),
  price: Joi.number().positive(),
  priceAfterOffer: Joi.number().positive().allow(null),
  isActive: Joi.boolean(),
})
  .min(1)
  .custom((value, helpers) => {
    const { price, priceAfterOffer } = value;
    if (price !== undefined && priceAfterOffer !== undefined && priceAfterOffer !== null) {
      if (priceAfterOffer >= price) {
        return helpers.message("priceAfterOffer must be less than price");
      }
    }
    return value;
  });

// جديد: للتحقق من وجود سبب البلوك
const blockProductSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required().messages({
    "string.empty": "Block reason is required",
    "any.required": "Block reason is required",
  }),
});

module.exports = { createProductSchema, updateProductSchema, blockProductSchema };