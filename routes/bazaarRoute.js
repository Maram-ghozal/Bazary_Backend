const express = require('express');
const router = express.Router();
const bazaarController = require('../controller/bazaarControllers');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/roleMiddleware');
const validate = require("../middleware/validateMiddleware");
const { updateBazaarSchema } = require("../utils/validation/bazaarValidation");
const { createBrandSchema, updateBrandSchema } = require("../utils/validation/brandValidation");
const upload = require("../middleware/uploadMiddleware");
const uploadOnImageKit = require("../middleware/Imagekitmiddleware");
const validateDimensions = require("../middleware/validateDimensions");

router.use(verifyToken, requireRole('BAZAAR_OWNER'));

router.get('/dashboard/brandComparsion', bazaarController.getBrandsComparison);
router.get('/dashboard/brandComparsion/:bazaarId', bazaarController.getBrandsComparison);

router.get('/dashboard/salesByHour', bazaarController.getSalesByHour);
router.get('/dashboard/salesByHour/:bazaarId', bazaarController.getSalesByHour);

router.get('/dashboard', bazaarController.getDashboard);
router.get('/dashboard/:bazaarId', bazaarController.getDashboard);


router.get('/control', bazaarController.getBazaarControl);
router.get('/control/:bazaarId', bazaarController.getBazaarControl);

router.patch('/control/toggle', validate(updateBazaarSchema), bazaarController.toggleRegistration);
router.patch('/control/automation', validate(updateBazaarSchema), bazaarController.updateAutomationRules);
router.get('/setting', bazaarController.getBazaar)
const bazaarImageFields = [
    { name: "logoUrl", maxCount: 1 },
    { name: "backgroundImage", maxCount: 1 },
];
const mapUploadedFilesToBody = (req, res, next) => {
    if (req.uploadedFiles) {
        if (req.uploadedFiles.logoUrl) req.body.logoUrl = req.uploadedFiles.logoUrl;
        if (req.uploadedFiles.backgroundImage) req.body.backgroundImage = req.uploadedFiles.backgroundImage;
    }
    next();
};

router.patch("/setting", upload.fields(bazaarImageFields), validateDimensions(1983, 793, "backgroundImage"), uploadOnImageKit,
    mapUploadedFilesToBody,
    validate(updateBazaarSchema), bazaarController.updateBazaar);
router.patch('/brands/:brandId', upload.fields(bazaarImageFields), validateDimensions(1983, 793, "backgroundImage"), uploadOnImageKit, mapUploadedFilesToBody, validate(updateBrandSchema), bazaarController.updateBrandByBazaar);
router.delete('/brands/:brandId', bazaarController.removeBrandFromBazaar);
router.post('/brands/add-direct', upload.fields(bazaarImageFields), validateDimensions(1983, 793, "backgroundImage"), uploadOnImageKit, mapUploadedFilesToBody, validate(createBrandSchema), bazaarController.addBrandDirectly);

// Brands management
router.get('/brands', bazaarController.getAllBrands);
router.get('/brands/:brandId', bazaarController.getOneBrand);

router.post("/dashboard-ai", bazaarController.getBazaarAIInsights);
// Waiting List management
router.get('/:bazaarId/waiting', bazaarController.getWaitingList);
router.patch('/waiting/:waitingId/approve', bazaarController.approveBrand);
router.patch('/waiting/:waitingId/reject', bazaarController.rejectBrand);

//history
router.get("/history", bazaarController.getBazaarHistory);

module.exports = router