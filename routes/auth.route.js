const express = require('express')
const router = express.Router()
const validateMiddleware = require("../middleware/validateMiddleware");
const { registerSchema } = require("../utils/validation/customerValidation");
const {register}=require("../controller/Auth/authController");
router.post('/register',validateMiddleware(registerSchema),register)







module.exports = router;