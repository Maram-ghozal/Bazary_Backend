const express=require('express');
const router=express.Router();
const bazaarController=require('../controller/bazaarControllers');
const verifyToken=require('../middleware/verifyToken');
const requireRole=require('../middleware/roleMiddleware');
const validate = require("../middleware/validateMiddleware");
const {updateBazaarSchema } = require("../utils/validation/bazaarValidation");

router.use(verifyToken,requireRole('BAZAAR_OWNER'));

router.get('/dashboard',bazaarController.getDashboard);
router.get('/dashboard/brandComparsion',bazaarController.getBrandsComparison);
router.get('/dashboard/salesByHour',bazaarController.getSalesByHour);
router.get('/control',bazaarController.getBazaarControl);
router.patch('/control/toggle',validate(updateBazaarSchema),bazaarController.toggleRegistration);
module.exports=router