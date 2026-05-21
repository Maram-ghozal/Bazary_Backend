const Joi = require("joi");

const createPaymentSchema = Joi.object({
    userId:Joi.string().hex().length(24).required(),
    amount:Joi.number().positive().required(),
    purpose:Joi.string().valid('BRAND_SUBSCRIPTION', 'BAZAAR_SUBSCRIPTION', 'BRAND_ENTRY_FEE', 'ORDER_CHECKOUT')
    .required(),
    orderId: Joi.string().hex().length(24)
})
module.exports = { createPaymentSchema };