const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit');
const validateMiddleware = require("../middleware/validateMiddleware");
const { registerSchema, loginSchema } = require("../utils/validation/customerValidation");
const { createBazaarSchema } = require('../utils/validation/bazaarValidation');
const { createBrandSchema } = require('../utils/validation/brandValidation');
const parseSocialMediaLinks = require("../middleware/parseSocialMediaLinks");

const {
    register, login, logout,
    forgotPassword, resetPassword,
    registerBazaar,
    registerBrand,
    getPackages
} = require("../controller/Auth/authController");
const upload = require("../middleware/uploadMiddleware");
const uploadOnImageKit = require("../middleware/Imagekitmiddleware");
const validateDimensions = require("../middleware/validateDimensions");

// Customer
router.post('/register/customer', validateMiddleware(registerSchema), register);
router.post('/login', validateMiddleware(loginSchema), login);
router.post('/logout', logout);

// Password
const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: { status: 'fail', message: 'Too many requests, try again after 10 minutes' }
});
router.post('/forgotPassword',otpLimiter, forgotPassword);
router.post('/resetPassword', resetPassword);

router.get('/packages', getPackages)

// Bazaar
const registrationImageFields = [
    { name: "logoUrl", maxCount: 1 },
    { name: "backgroundImage", maxCount: 1 },
];

router.post('/register/bazaar',
    upload.fields(registrationImageFields),
    validateDimensions(1983, 793, "backgroundImage"),
    uploadOnImageKit,
    parseSocialMediaLinks,
    validateMiddleware(createBazaarSchema),
    registerBazaar);

// Brand 
router.post('/bazaars/:bazaarId/brands/register',
    upload.fields(registrationImageFields),
    validateDimensions(1983, 793, "backgroundImage"),
    uploadOnImageKit,
    parseSocialMediaLinks,
    validateMiddleware(createBrandSchema),
    registerBrand
);

module.exports = router