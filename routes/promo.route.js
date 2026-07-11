const express = require('express');
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const roleMiddleware = require("../middleware/roleMiddleware");
const { spinPromoCode, validatePromoCode } = require('../controller/promoController');

router.use(verifyToken, roleMiddleware("ADMIN","BAZAAR_OWNER","BRAND_OWNER","CUSTOMER"));

router.post('/spin', spinPromoCode);           
router.post('/validate', validatePromoCode);   

module.exports = router;