const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/verifyToken");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validateMiddleware");
const upload = require("../middleware/uploadMiddleware");
const uploadOnImageKit = require("../middleware/Imagekitmiddleware");

const { updateBrandSchema } = require("../utils/validation/brandValidation");
const { createProductSchema, updateProductSchema } = require("../utils/validation/productValidation");

const { getMyBrand, updateBrand, getDashboard, suggestDescription } = require("../controller/brandController");
const { getAllProducts, getOneProduct, createProduct, updateProduct, deleteProduct } = require("../controller/productController");

const { getAllOrders, getOneOrder, updateOrderStatus } = require("../controller/orderController");

const validateDimensions = require("../middleware/validateDimensions");


router.use(verifyToken,roleMiddleware("BRAND_OWNER"));

// Brand
router.get("/dashboard", getDashboard);
router.get("/", getMyBrand);
router.patch("/", upload.single("logoUrl"),validateDimensions(1920,1080), uploadOnImageKit, validate(updateBrandSchema), updateBrand);

// Products
router.get("/products", getAllProducts);
router.get("/products/:productId", getOneProduct);
router.post("/products", validate(createProductSchema), upload.array("images"), uploadOnImageKit, createProduct);
router.patch("/products/:productId", validate(updateProductSchema), upload.array("images"), uploadOnImageKit, updateProduct);
router.delete("/products/:productId", deleteProduct);

// Orders
router.get("/orders", getAllOrders);
router.get("/orders/:orderId", getOneOrder);
router.patch("/orders/:orderId/status", updateOrderStatus);

router.post("/suggest-description", suggestDescription);

module.exports = router;