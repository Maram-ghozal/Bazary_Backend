const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Brand = require("../models/brandModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");

//get /api/brand/dashboard
const getDashboard = asyncWrapper(async (req, res, next) => {
  const brand = await Brand.findOne({ userId: req.user.id });
  if (!brand) return next(AppError.createError("Brand not found", 404, httpStatus.FAIL));

  const bazaarBrand = await BazaarBrand.findOne({ brandId: brand._id });
  if (!bazaarBrand) return next(AppError.createError("Brand is not part of any bazaar", 403, httpStatus.FAIL));

  //get all orders of the btand without status cancelled
  const orders = await Order.find({
    brandId: brand._id,
    status: { $in: ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"] }
  });

  const ordersCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgOrderValue = ordersCount > 0 ? +(totalRevenue / ordersCount).toFixed(2) : 0;

  // Top Selling Products
   const topSelling = await Order.aggregate([
    { $match: { brandId: brand._id, status: { $in: ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"] } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.productId", totalSold: { $sum: "$items.quantity" } } },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $project: { _id: 0 //hideId 
    , totalSold: 1, name: "$product.name", images: "$product.images", quantity: "$product.quantity", price: "$product.price" } }
  ]);
  res.json({ status: httpStatus.SUCCESS, data: { totalRevenue, ordersCount, avgOrderValue, topSelling} });
});

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

module.exports = { getMyBrand, updateBrand, getDashboard };
