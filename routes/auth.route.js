const express = require('express')
const router = express.Router()
const validateMiddleware = require("../middleware/validateMiddleware");
const { registerSchema, loginSchema } = require("../utils/validation/customerValidation");
const { createBazaarSchema } = require('../utils/validation/bazaarValidation');
const { createBrandSchema } = require('../utils/validation/brandValidation');
const {
    register, login, logout,
    forgotPassword, resetPassword,
    registerBazaar,
    registerBrand 
} = require("../controller/Auth/authController");

// Customer
router.post('/register/customer', validateMiddleware(registerSchema), register);
router.post('/login', validateMiddleware(loginSchema), login);
router.post('/logout', logout);

// Password
router.post('/forgotPassword', forgotPassword);
router.post('/resetPassword', resetPassword);

// Bazaar
router.post('/register/bazaar', validateMiddleware(createBazaarSchema), registerBazaar);

// Brand 
router.post('/bazaars/:bazaarId/brands/register',validateMiddleware(createBrandSchema) ,registerBrand);
module.exports=router