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
router.patch("/setting", upload.single("logoUrl"), validateDimensions(1983, 793), uploadOnImageKit,
    (req, res, next) => {
        if (req.imagesUrls && req.imagesUrls.length > 0) {
            req.body.logoUrl = req.imagesUrls[0];
        }
        next();
    },
    validate(updateBazaarSchema), bazaarController.updateBazaar);
router.patch('/brands/:brandId', upload.single("logoUrl"), validateDimensions(1983, 793), uploadOnImageKit, validate(updateBrandSchema), bazaarController.updateBrandByBazaar);
router.delete('/brands/:brandId', bazaarController.removeBrandFromBazaar);
router.post('/brands/add-direct', upload.single("logoUrl"), validateDimensions(1983, 793), uploadOnImageKit, validate(createBrandSchema), bazaarController.addBrandDirectly);

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