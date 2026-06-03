const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Product = require("../models/productModel");
const { checkBrandExists, getStockStatus } = require("../utils/helperBrand");

//get /api/brand/:brandId/products
const getAllProducts = asyncWrapper(async (req, res, next) => {
  const { brandId } = req.params;
  await checkBrandExists(brandId);
  const products = await Product.find({ brandId}).sort({ createdAt: -1 });
  //to add stockStatus
  let result = products.map((p) => ({...p.toObject(),stockStatus: getStockStatus(p.quantity)}));
  //to filter based on status
  const { status } = req.query;
  if (status) {
    result = result.filter((p) => p.stockStatus === status.toUpperCase());
  }
  res.json({ status: httpStatus.SUCCESS, data: { total: result.length, products: result }});
});

//get /api/brand/:brandId/products/:productId
const getOneProduct = asyncWrapper(async (req, res, next) => {
  const { brandId, productId } = req.params;
  await checkBrandExists(brandId);
  const product = await Product.findOne({ _id: productId, brandId});
  if (!product) {
    return next(AppError.createError("Product not found", 404, httpStatus.FAIL));
  }
  res.json({status: httpStatus.SUCCESS,data: { ...product.toObject(), stockStatus: getStockStatus(product.quantity) },
  });
});

//post /api/brand/:brandId/products
const createProduct = asyncWrapper(async (req, res, next) => {
  const { brandId } = req.params;
  await checkBrandExists(brandId);
  //
   const images = req.imagesUrls || [];
  const product = await Product.create({ brandId, ...req.body, images  });
  res.status(201).json({ status: httpStatus.SUCCESS, message: "Product created successfully",data: { ...product.toObject(), stockStatus: getStockStatus(product.quantity) } });
});

//patch /api/brand/:brandId/products/:productId
const updateProduct = asyncWrapper(async (req, res, next) => {
  const { brandId, productId } = req.params;
  await checkBrandExists(brandId);
  //check priceOffer
  if (req.body.priceAfterOffer) {
  const existingProduct = await Product.findOne({ _id: productId, brandId });
  const currentPrice = req.body.price ?? existingProduct.price;
  if (req.body.priceAfterOffer >= currentPrice) {
    return next(AppError.createError('priceAfterOffer must be less than price', 400, httpStatus.FAIL));
  }
}
  const body = { ...req.body };
  if (req.imagesUrls && req.imagesUrls.length > 0) {
    body.images = req.imagesUrls;
  }

  const product = await Product.findOneAndUpdate( { _id: productId, brandId}, body, { new: true } );
  if (!product) {
    return next(AppError.createError("Product not found", 404, httpStatus.FAIL));
  }
  res.json({ status: httpStatus.SUCCESS, message: "Product updated successfully", data: { ...product.toObject(), stockStatus: getStockStatus(product.quantity) } });
});

//delete /api/brand/:brandId/products/:productId 
const deleteProduct = asyncWrapper(async (req, res, next) => {
  const { brandId, productId } = req.params;
  await checkBrandExists(brandId);
  const product = await Product.findOneAndDelete({ _id: productId, brandId });
  if (!product) {
    return next(
      AppError.createError("Product not found", 404, httpStatus.FAIL)
    );
  }
  res.json({ status: httpStatus.SUCCESS, message: "Product deleted successfully" });
});

module.exports = {
  getAllProducts,
  getOneProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};