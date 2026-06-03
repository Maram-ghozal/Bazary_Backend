const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Brand = require("../models/brandModel");

//get /api/brand
const getAllBrands = asyncWrapper(async (req, res, next) => {
  const brands = await Brand.find({}).sort({ createdAt: -1 });
  res.json({ status: httpStatus.SUCCESS, data: { total: brands.length, brands } });
});
//get  /api/brand/:brandId
const getOneBrand = asyncWrapper(async (req, res, next) => {
  const brand = await Brand.findById(req.params.brandId);
  if (!brand) {
    return next(AppError.createError("Brand not found", 404, httpStatus.FAIL));
  }
  res.json({ status: httpStatus.SUCCESS, data: brand });
});

//patch /api/brand/:brandId
const updateBrand = asyncWrapper(async (req, res, next) => {
  const body = { ...req.body };
  const brandId = req.params.brandId;
  
  if (req.imagesUrls && req.imagesUrls.length > 0) {
    body.logoUrl = req.imagesUrls[0];
  }
  const brand = await Brand.findByIdAndUpdate(brandId, body, { new: true });
  if (!brand) {
    return next(AppError.createError("Brand not found", 404, httpStatus.FAIL));
  }
  res.json({ status: httpStatus.SUCCESS, message: "Brand updated successfully",data: brand});
});

module.exports = { getAllBrands, getOneBrand, updateBrand };
