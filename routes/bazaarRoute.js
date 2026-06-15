const express=require('express');
const router=express.Router();
const bazaarController=require('../controller/bazaarControllers');
const verifyToken=require('../middleware/verifyToken');
const requireRole=require('../middleware/roleMiddleware');
const validate = require("../middleware/validateMiddleware");
const {updateBazaarSchema } = require("../utils/validation/bazaarValidation");
const upload = require("../middleware/uploadMiddleware");
const uploadOnImageKit = require("../middleware/Imagekitmiddleware");

router.use(verifyToken,requireRole('BAZAAR_OWNER'));

router.get('/dashboard',bazaarController.getDashboard);
router.get('/dashboard/brandComparsion',bazaarController.getBrandsComparison);
router.get('/dashboard/salesByHour',bazaarController.getSalesByHour);
router.get('/control',bazaarController.getBazaarControl);
router.patch('/control/toggle',validate(updateBazaarSchema),bazaarController.toggleRegistration);
router.patch('/control/automation',validate(updateBazaarSchema),bazaarController.updateAutomationRules);
router.get('/setting',bazaarController.getBazaar)
router.patch("/setting", validate(updateBazaarSchema), upload.single("logoUrl"), uploadOnImageKit,bazaarController.updateBazaar);

// Brands management
router.get('/brands', bazaarController.getAllBrands);
router.get('/brands/:brandId', bazaarController.getOneBrand);

router.post("/dashboard-ai", bazaarController.getBazaarAIInsights);
// Waiting List management
router.get('/waiting', bazaarController.getWaitingList);
router.patch('/waiting/:waitingId/approve', bazaarController.approveBrand);
router.patch('/waiting/:waitingId/reject', bazaarController.rejectBrand);
module.exports=router