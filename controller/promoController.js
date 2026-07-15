const asyncWrapper = require("../middleware/asyncWrapper");
const appError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const PromoCode = require("../models/promoCodeModel");

const spinPromoCode = asyncWrapper(async (req, res, next) => {
  const userId = req.user.id;

  const existing = await PromoCode.findOne({ "usedBy.userId": userId });
  if (existing) {
    return res.json({
      status: httpStatus.SUCCESS,
      message: "You already have a promo code",
      data: { code: existing.code, discount: existing.discountPercentage }
    });
  }

  const promo = await PromoCode.getRandomPromo();
  
  res.status(201).json({
    status: httpStatus.SUCCESS,
    message: "🎉 Congratulations! Here's your promo code",
    data: {
      code: promo.code,
      discountPercentage: promo.discountPercentage
    }
  });
});

const validatePromoCode = asyncWrapper(async (req, res, next) => {
  const { code } = req.body;
  if (!code) return next(appError.createError("Promo code is required", 400, httpStatus.FAIL));

  const promo = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true });
  if (!promo) {
    return next(appError.createError("Invalid or expired promo code", 400, httpStatus.FAIL));
  }

  const userId = req.user.id;
  const alreadyUsed = promo.usedBy.some(u => u.userId.toString() === userId.toString());

  if (alreadyUsed) {
    return next(appError.createError("You already used this promo code", 400, httpStatus.FAIL));
  }

  res.json({
    status: httpStatus.SUCCESS,
    data: { valid: true, discountPercentage: promo.discountPercentage }
  });
});

module.exports = { spinPromoCode, validatePromoCode };