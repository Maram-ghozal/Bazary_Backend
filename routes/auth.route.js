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
const upload = require("../middleware/uploadMiddleware");
const uploadOnImageKit = require("../middleware/Imagekitmiddleware");
const validateDimensions = require("../middleware/validateDimensions");

// Customer
router.post('/register/customer', validateMiddleware(registerSchema), register);
router.post('/login', validateMiddleware(loginSchema), login);
router.post('/logout', logout);

// Password
router.post('/forgotPassword', forgotPassword);
router.post('/resetPassword', resetPassword);

// Bazaar
router.post('/register/bazaar',
    upload.single("logoUrl"),
    validateDimensions(1920, 1080),
    uploadOnImageKit, validateMiddleware(createBazaarSchema),
    registerBazaar);

// Brand 
router.post('/bazaars/:bazaarId/brands/register',
    upload.single("logoUrl"),
    validateDimensions(1920, 1080),
    uploadOnImageKit,
    validateMiddleware(createBrandSchema),
    registerBrand
);
module.exports = router
