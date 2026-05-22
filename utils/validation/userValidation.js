const Joi =require ('joi')
// create user
const createUserSchema=Joi.object({
    email:Joi.string().required().email(),
    password:Joi.string().min(8).required(),
    googleId:Joi.string().optional(),
    role: Joi.string()
    .valid('CUSTOMER', 'BRAND_OWNER', 'BAZAAR_OWNER', 'ADMIN')
    .default("CUSTOMER")
});

//update user schema
const updateUserSchema = Joi.object({
  email: Joi.string().email(),
  password: Joi.string().min(8),
  role: Joi.string().valid('CUSTOMER', 'BRAND_OWNER', 'BAZAAR_OWNER', 'ADMIN')
});

module.exports = { createUserSchema, updateUserSchema };