const express = require("express");
const router = express.Router();

const validate = require("../middleware/validateMiddleware");
const { updateBrandSchema } = require("../utils/validation/brandValidation");
const {
  createProductSchema,
  updateProductSchema,
} = require("../utils/validation/productValidation");

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
router.patch("/:brandId", validate(updateBrandSchema), updateBrand);

//Products
router.get("/:brandId/products", getAllProducts);
router.get("/:brandId/products/:productId", getOneProduct);
router.post("/:brandId/products", validate(createProductSchema), createProduct);
router.patch("/:brandId/products/:productId", validate(updateProductSchema), updateProduct,);
router.delete("/:brandId/products/:productId", deleteProduct);

module.exports = router;
