const Brand = require("../models/brandModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const Bazaar = require("../models/bazaarModel");
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

const getBrandWithBazaar = async (userId, next) => {
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
  const bazaar = await Bazaar.findById(bazaarBrand.bazaarId);
  return { brand, bazaarBrand, bazaar };
};

const checkBazaarNotEnded = (bazaar, next) => {
  if (bazaar && bazaar.status === "ENDED") {
    next( AppError.createError( "The bazaar has ended. You can only view your data now.", 403, httpStatus.FAIL) );
    return false;
  }
  return true;
};

module.exports = { getStockStatus, checkBrandExists, getBrandWithBazaar, checkBazaarNotEnded };
