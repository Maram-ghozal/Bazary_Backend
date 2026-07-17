const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Product = require("../models/productModel");
const { getBrandWithBazaar, checkBazaarNotEnded, getStockStatus } = require("../utils/helperBrand");
const { getRatingsMap, getRatingFor } = require("../utils/helperRating");

//get /api/brand/products
const getAllProducts = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand } = result;

  let products = await Product.find({ brandId: brand._id }).sort({ createdAt: -1 });
  const ratingsMap = await getRatingsMap(products.map((p) => p._id));

  let mapped = products.map((p) => {
    const { avgRating, ratingCount } = getRatingFor(ratingsMap, p._id);
    return {
      ...p.toObject(),
      stockStatus: getStockStatus(p.quantity),
      blockStatus: p.isActive ? "ACTIVE" : "BLOCKED",
      avgRating,
      ratingCount,
    };
  });

  const { status, blockStatus } = req.query;

  if (status) {
    mapped = mapped.filter((p) => p.stockStatus === status.toUpperCase());
  }

  if (blockStatus) {
    mapped = mapped.filter((p) => p.blockStatus === blockStatus.toUpperCase());
  }

  res.json({ status: httpStatus.SUCCESS, data: { total: mapped.length, products: mapped } });
});

//get /api/brand/products/:productId
const getOneProduct = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand } = result;

  const product = await Product.findOne({ _id: req.params.productId, brandId: brand._id });
  if (!product) return next(AppError.createError("Product not found", 404, httpStatus.FAIL));

  const ratingsMap = await getRatingsMap([product._id]);
  const { avgRating, ratingCount } = getRatingFor(ratingsMap, product._id);

  res.json({ status: httpStatus.SUCCESS, data: { ...product.toObject(), stockStatus: getStockStatus(product.quantity), blockStatus: product.isActive ? "ACTIVE" : "BLOCKED", avgRating, ratingCount } });
});

//post /api/brand/products
const createProduct = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand, bazaar } = result;

  if (!checkBazaarNotEnded(bazaar, next)) return;

  const images = req.imagesUrls || [];
  const product = await Product.create({ brandId: brand._id, ...req.body, images });

  res.status(201).json({ status: httpStatus.SUCCESS, message: "Product created successfully", data: { ...product.toObject(), stockStatus: getStockStatus(product.quantity) } });
});

//patch /api/brand/products/:productId
const updateProduct = asyncWrapper(async (req, res, next) => {
 const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand, bazaar } = result;
 
  if (!checkBazaarNotEnded(bazaar, next)) return;

  if (req.body.priceAfterOffer) {
    const existing = await Product.findOne({ _id: req.params.productId, brandId: brand._id });
    const currentPrice = req.body.price ?? existing.price;
    if (req.body.priceAfterOffer >= currentPrice) {
      return next(AppError.createError("priceAfterOffer must be less than price", 400, httpStatus.FAIL));
    }
  }

  const body = { ...req.body };
  if (req.imagesUrls && req.imagesUrls.length > 0) {
    const existingProduct = await Product.findOne({ _id: req.params.productId, brandId: brand._id });
    if (!existingProduct) return next(AppError.createError("Product not found", 404, httpStatus.FAIL));

    body.images = [...(existingProduct.images || []), ...req.imagesUrls];
  }

  const product = await Product.findOneAndUpdate(
    { _id: req.params.productId, brandId: brand._id },
    body,
    { new: true }
  );
  if (!product) return next(AppError.createError("Product not found", 404, httpStatus.FAIL));

  res.json({ status: httpStatus.SUCCESS, message: "Product updated successfully", data: { ...product.toObject(), stockStatus: getStockStatus(product.quantity) } });
});

//delete /api/brand/products/:productId
const deleteProduct = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand, bazaar } = result;
 
  if (!checkBazaarNotEnded(bazaar, next)) return;

  const product = await Product.findOneAndDelete({ _id: req.params.productId, brandId: brand._id });
  if (!product) return next(AppError.createError("Product not found", 404, httpStatus.FAIL));

  res.json({ status: httpStatus.SUCCESS, message: "Product deleted successfully" });
});

module.exports = { getAllProducts, getOneProduct, createProduct, updateProduct, deleteProduct };