const express = require('express')
const router = express.Router()
const validateMiddleware = require("../middleware/validateMiddleware");
const { registerSchema ,loginSchema} = require("../utils/validation/customerValidation");
const {register,login,logout,forgotPassword,resetPassword}=require("../controller/Auth/authController");
router.post('/register/customer',validateMiddleware(registerSchema),register)
router.post('/login',validateMiddleware(loginSchema),login)
router.post('/forgotPassword', forgotPassword);
router.post('/resetPassword/:token', resetPassword);
router.post('/logout',logout)







module.exports = router;