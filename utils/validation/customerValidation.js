const Joi = require ('joi')
const registerSchema=Joi.object({
    // userId: Joi.string().hex().length(24).required(),
    // fullName: Joi.string().min(3).max(50).required()
    fullName: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required()
});
const loginSchema=Joi.object({
    
    email: Joi.string().email().required(),
    password: Joi.string().required()
});
const updateCustomerSchema=Joi.object({
    
    fullName: Joi.string().min(3).max(50)
});
module.exports = { registerSchema, updateCustomerSchema,loginSchema };