const express=require('express');
const router=express.Router();
const bazaarController=require('../controller/bazaarControllers');
const verifyToken=require('../middleware/verifyToken');
const requireRole=require('../middleware/roleMiddleware');
const validate = require("../middleware/validateMiddleware");
const {updateBazaarSchema } = require("../utils/validation/bazaarValidation");
const { createBrandSchema,updateBrandSchema } = require("../utils/validation/brandValidation");
const upload = require("../middleware/uploadMiddleware");
const uploadOnImageKit = require("../middleware/Imagekitmiddleware");
const validateDimensions = require("../middleware/validateDimensions");

router.use(verifyToken,requireRole('BAZAAR_OWNER'));

router.get('/dashboard',bazaarController.getDashboard);
router.get('/dashboard/brandComparsion',bazaarController.getBrandsComparison);
router.get('/dashboard/salesByHour',bazaarController.getSalesByHour);
router.get('/control',bazaarController.getBazaarControl);
router.patch('/control/toggle',validate(updateBazaarSchema),bazaarController.toggleRegistration);
router.patch('/control/automation',validate(updateBazaarSchema),bazaarController.updateAutomationRules);
router.get('/setting',bazaarController.getBazaar)
router.patch("/setting", upload.single("logoUrl"), validateDimensions(1920,1080), uploadOnImageKit,validate(updateBazaarSchema),bazaarController.updateBazaar);
router.patch('/brands/:brandId', upload.single("logoUrl"),validateDimensions(1920,1080), uploadOnImageKit,validate(updateBrandSchema), bazaarController.updateBrandByBazaar);
router.delete('/brands/:brandId', bazaarController.removeBrandFromBazaar);
router.post('/brands/add-direct', upload.single("logoUrl"),validateDimensions(1920,1080), uploadOnImageKit,validate(createBrandSchema), bazaarController.addBrandDirectly);

// Brands management
router.get('/brands', bazaarController.getAllBrands);
router.get('/brands/:brandId', bazaarController.getOneBrand);

router.post("/dashboard-ai", bazaarController.getBazaarAIInsights);
// Waiting List management
router.get('/:bazaarId/waiting', bazaarController.getWaitingList);
router.patch('/waiting/:waitingId/approve', bazaarController.approveBrand);
router.patch('/waiting/:waitingId/reject', bazaarController.rejectBrand);
module.exports=router