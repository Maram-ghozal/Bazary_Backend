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
router.post('/forgotPassword', forgotPassword);
router.post('/resetPassword', resetPassword);

router.get('/packages',getPackages)
// Bazaar
const registrationImageFields = [
    { name: "logoUrl", maxCount: 1 },
    { name: "backgroundImage", maxCount: 1 },
];

router.post('/register/bazaar',
    upload.fields(registrationImageFields),
    validateDimensions(1983, 793, "backgroundImage"),
    uploadOnImageKit, validateMiddleware(createBazaarSchema),
    registerBazaar);

// Brand 
router.post('/bazaars/:bazaarId/brands/register',
    upload.fields(registrationImageFields),
    validateDimensions(1983, 793, "backgroundImage"),
    uploadOnImageKit,
    validateMiddleware(createBrandSchema),
    registerBrand
);
module.exports = router
