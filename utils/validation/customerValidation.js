const Joi = require ('joi')
const createCustomerSchema=Joi.object({
    userId: Joi.string().hex().length(24).required(),
    fullName: Joi.string().min(3).max(50).required()
});

const updateCustomerSchema=Joi.object({
    
    fullName: Joi.string().min(3).max(50)
});
module.exports = { createCustomerSchema, updateCustomerSchema };