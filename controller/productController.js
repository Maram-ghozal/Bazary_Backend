const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Product = require("../models/productModel");
const Brand = require("../models/brandModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const { getStockStatus } = require("../utils/helperBrand");

const getBrandAndVerify = async (userId, next) => {
  const brand = await Brand.findOne({ userId });
  if (!brand) {
    next(AppError.createError("Brand not found", 404, httpStatus.FAIL));
    return null;
  }
  const bazaarBrand = await BazaarBrand.findOne({ brandId: brand._id });
  if (!bazaarBrand) {
    next(AppError.createError("Brand is not part of any bazaar", 403, httpStatus.FAIL));
    return null;
  }
  return brand;
};

//get /api/brand/products
const getAllProducts = asyncWrapper(async (req, res, next) => {
  const brand = await getBrandAndVerify(req.user.id, next);
  if (!brand) return;

  let products = await Product.find({ brandId: brand._id }).sort({ createdAt: -1 });
  //to add stock status
  let result = products.map((p) => ({ ...p.toObject(), stockStatus: getStockStatus(p.quantity) }));
//to filter by stock status if provided in query
  const { status } = req.query;
  if (status) {
    result = result.filter((p) => p.stockStatus === status.toUpperCase());
  }

  res.json({ status: httpStatus.SUCCESS, data: { total: result.length, products: result } });
});

//get /api/brand/products/:productId
const getOneProduct = asyncWrapper(async (req, res, next) => {
  const brand = await getBrandAndVerify(req.user.id, next);
  if (!brand) return;

  const product = await Product.findOne({ _id: req.params.productId, brandId: brand._id });
  if (!product) return next(AppError.createError("Product not found", 404, httpStatus.FAIL));

  res.json({ status: httpStatus.SUCCESS, data: { ...product.toObject(), stockStatus: getStockStatus(product.quantity) } });
});

//post /api/brand/products
const createProduct = asyncWrapper(async (req, res, next) => {
  const brand = await getBrandAndVerify(req.user.id, next);
  if (!brand) return;

  const images = req.imagesUrls || [];
  const product = await Product.create({ brandId: brand._id, ...req.body, images });

  res.status(201).json({ status: httpStatus.SUCCESS, message: "Product created successfully", data: { ...product.toObject(), stockStatus: getStockStatus(product.quantity) } });
});

//patch /api/brand/products/:productId
const updateProduct = asyncWrapper(async (req, res, next) => {
  const brand = await getBrandAndVerify(req.user.id, next);
  if (!brand) return;

  if (req.body.priceAfterOffer) {
    const existing = await Product.findOne({ _id: req.params.productId, brandId: brand._id });
    const currentPrice = req.body.price ?? existing.price;
    if (req.body.priceAfterOffer >= currentPrice) {
      return next(AppError.createError("priceAfterOffer must be less than price", 400, httpStatus.FAIL));
    }
  }

  const body = { ...req.body };
  if (req.imagesUrls && req.imagesUrls.length > 0) {
    body.images = req.imagesUrls;
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
  const brand = await getBrandAndVerify(req.user.id, next);
  if (!brand) return;

  const product = await Product.findOneAndDelete({ _id: req.params.productId, brandId: brand._id });
  if (!product) return next(AppError.createError("Product not found", 404, httpStatus.FAIL));

  res.json({ status: httpStatus.SUCCESS, message: "Product deleted successfully" });
});

module.exports = { getAllProducts, getOneProduct, createProduct, updateProduct, deleteProduct };