const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Brand = require("../models/brandModel");
const BazaarBrand = require("../models/bazaarBrandModel");

//get /api/brand
const getMyBrand = asyncWrapper(async (req, res, next) => {
  const brand = await Brand.findOne({ userId: req.user.id });
  if (!brand) return next(AppError.createError("Brand not found", 404, httpStatus.FAIL));

  const bazaarBrand = await BazaarBrand.findOne({ brandId: brand._id });
  if (!bazaarBrand) return next(AppError.createError("Brand is not part of any bazaar", 403, httpStatus.FAIL));

  res.json({ status: httpStatus.SUCCESS, data: brand });
});

//patch /api/brand/:brandId
const updateBrand = asyncWrapper(async (req, res, next) => {
  const brand = await Brand.findOne({ userId: req.user.id });
  if (!brand) return next(AppError.createError("Brand not found", 404, httpStatus.FAIL));

  const bazaarBrand = await BazaarBrand.findOne({ brandId: brand._id });
  if (!bazaarBrand) return next(AppError.createError("Brand is not part of any bazaar", 403, httpStatus.FAIL));

  const body = { ...req.body };
  if (req.imagesUrls && req.imagesUrls.length > 0) {
    body.logoUrl = req.imagesUrls[0];
  }

  const updated = await Brand.findByIdAndUpdate(brand._id, body, { new: true });
  res.json({ status: httpStatus.SUCCESS, message: "Brand updated successfully", data: updated });
});

module.exports = { getMyBrand, updateBrand };
