const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validateMiddleware");
const upload = require("../middleware/uploadMiddleware");
const uploadOnImageKit = require("../middleware/Imagekitmiddleware");
const { updateAdminProfileSchema } = require("../utils/validation/adminValidation");
const {
  getDashboardStats,
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  getOneUser,
  updateUser,
  deleteUser,
  getAllBazaars,
  getOneBazaar,
  updateBazaar,
  deleteBazaar,
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
} = require("../controller/adminController");

router.use(verifyToken, roleMiddleware("ADMIN"));

// Dashboard
router.get("/dashboard", getDashboardStats);

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
router.delete("/bazaars/:id", deleteBazaar);

// Brands
router.get("/brands", getAllBrands);
router.get("/brands/:id", getOneBrand);
router.patch("/brands/:id", updateBrand);
router.delete("/brands/:id", deleteBrand);

// Products
router.get("/products", getAllProducts);
router.get("/products/:id", getOneProduct);
router.patch("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// Orders
router.get("/orders", getAllOrders);
router.get("/orders/:id", getOneOrder);
router.patch("/orders/:id", updateOrder);
router.delete("/orders/:id", deleteOrder);

module.exports = router;