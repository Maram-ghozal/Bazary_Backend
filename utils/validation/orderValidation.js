const Joi = require("joi");

const createOrderSchema = Joi.object({
  brandId: Joi.string().hex().length(24).required(), // MongoDB ObjectId
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().hex().length(24).required(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .required(),
});

// البراند تقدر تغير status الأوردر بس
const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid("PENDING", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED")
    .required(),
});

module.exports = { createOrderSchema, updateOrderStatusSchema };
