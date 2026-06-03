const express = require('express')
const router = express.Router()
const validateMiddleware = require("../middleware/validateMiddleware");
const { registerSchema ,loginSchema} = require("../utils/validation/customerValidation");
const {register,login,logout,forgotPassword,resetPassword,registerBazaar}=require("../controller/Auth/authController");
const { createBazaarSchema } = require('../utils/validation/bazaarValidation');
router.post('/register/customer',validateMiddleware(registerSchema),register)
// الراوت ده هيكون اللينك بتاعه: /api/auth/register/bazaar
router.post(
    '/register/bazaar', 
    validateMiddleware(createBazaarSchema), 
    registerBazaar
);
router.post('/login',validateMiddleware(loginSchema),login)
router.post('/forgotPassword', forgotPassword);
router.post('/resetPassword', resetPassword);
router.post('/logout',logout)







module.exports = router;