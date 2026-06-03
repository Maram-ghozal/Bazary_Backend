const express = require("express");
const router = express.Router();

const validate = require("../middleware/validateMiddleware");
const { updateBrandSchema } = require("../utils/validation/brandValidation");
const {
  createProductSchema,
  updateProductSchema,
} = require("../utils/validation/productValidation");

const upload = require("../middleware/uploadMiddleware");
const uploadOnImageKit = require("../middleware/imagekitMiddleware");

const {
  getAllBrands,
  getOneBrand,
  updateBrand,
} = require("../controller/brandController");

const {
  getAllProducts,
  getOneProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controller/productController");

//Brand
router.get("/", getAllBrands);
router.get("/:brandId", getOneBrand);
router.patch("/:brandId", validate(updateBrandSchema),upload.single("logoUrl"),uploadOnImageKit, updateBrand);

//Products
router.get("/:brandId/products", getAllProducts);
router.get("/:brandId/products/:productId", getOneProduct);
router.post("/:brandId/products", validate(createProductSchema), upload.array("images"), uploadOnImageKit, createProduct);
router.patch("/:brandId/products/:productId", validate(updateProductSchema), upload.array("images"), uploadOnImageKit, updateProduct);
router.delete("/:brandId/products/:productId", deleteProduct);

module.exports = router;
