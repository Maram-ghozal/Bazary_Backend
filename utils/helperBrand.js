const Brand = require("../models/brandModel");
const AppError = require("./appError");
const httpStatus = require("./httpStatusText");

const checkBrandExists = async (brandId, next) => {
  const brand = await Brand.findById(brandId);
  if (!brand) {
    throw AppError.createError("Brand not found", 404, httpStatus.FAIL);
  }
  return brand;
};

const getStockStatus = (quantity) => {
  if (quantity === 0) return "OUT_OF_STOCK";
  if (quantity <= 10) return "LOW_STOCK";
  return "IN_STOCK";
};

module.exports = { getStockStatus, checkBrandExists };
