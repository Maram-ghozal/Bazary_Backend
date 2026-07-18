const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validateMiddleware");
const upload = require("../middleware/uploadMiddleware");
const uploadOnImageKit = require("../middleware/Imagekitmiddleware");
const { updateAdminProfileSchema } = require("../utils/validation/adminValidation");
const { blockBrandSchema } = require("../utils/validation/brandValidation");
const { blockProductSchema } = require("../utils/validation/productValidation");
const {
  getDashboardStats,
  getDashboardAnalytics,
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  getOneUser,
  updateUser,
  deleteUser,
  getAllBazaars,
  getOneBazaar,
  updateBazaar,
  getAllBrands,
  getOneBrand,
  updateBrand,
  deleteBrand,
  getAllProducts,
  getOneProduct,
  updateProduct,
  deleteProduct,
  getAllOrders,
  getOneOrder,
  updateOrder,
  deleteOrder,
  createBazaar,
createBrand,
createProduct,
createAdmin,
} = require("../controller/adminController");

router.use(verifyToken, roleMiddleware("ADMIN"));

// Dashboard
router.get("/dashboard", getDashboardStats);
router.get("/dashboard/analytics", getDashboardAnalytics);

// Admin Profile
router.get("/setting", getMyProfile);
router.patch("/setting",upload.single("photo"),uploadOnImageKit,validate(updateAdminProfileSchema),updateMyProfile);

// Users
router.get("/users", getAllUsers);
router.get("/users/:id", getOneUser);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Bazaars
router.get("/bazaars", getAllBazaars);
router.get("/bazaars/:id", getOneBazaar);
router.patch("/bazaars/:id", updateBazaar);

// Brands
router.get("/brands", getAllBrands);
router.get("/brands/:id", getOneBrand);
router.patch("/brands/:id",
  upload.fields([
    { name: "logoUrl", maxCount: 1 },
    { name: "backgroundImage", maxCount: 1 },
  ]),
  uploadOnImageKit,updateBrand);
router.delete("/brands/:id", validate(blockBrandSchema), deleteBrand);

// Products
router.get("/products", getAllProducts);
router.get("/products/:id", getOneProduct);
router.patch("/products/:id", upload.array("images"), uploadOnImageKit, updateProduct);
router.delete("/products/:id", validate(blockProductSchema), deleteProduct);
// Orders
router.get("/orders", getAllOrders);
router.get("/orders/:id", getOneOrder);
// ✅ Create
router.post(
  "/bazaars",
  upload.fields([
    { name: "logoUrl", maxCount: 1 },
    { name: "backgroundImage", maxCount: 1 },
  ]),
  uploadOnImageKit,
  createBazaar
);
router.post(
  "/brands",
  upload.fields([
    { name: "logoUrl", maxCount: 1 },
    { name: "backgroundImage", maxCount: 1 },
  ]),
  uploadOnImageKit,
  createBrand
);
router.post("/brands/:brandId/products", upload.array("images"), uploadOnImageKit, createProduct);
router.post("/admins", createAdmin);

module.exports = router;