const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Brand = require("../models/brandModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const { getBrandWithBazaar, checkBazaarNotEnded, getStockStatus } = require("../utils/helperBrand");

//get /api/brand/dashboard
const getDashboard = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand, bazaar } = result;
 
  const bazaarEnded = bazaar?.status === "ENDED";
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

  const rawRisks = await Product.find({ brandId: brand._id, isActive: true, quantity: { $lte: 10 } })
    .select("name images quantity")
    .sort({ quantity: 1 }) // from lowest to highest quantity
    .limit(10);
 
  const inventoryRisks = rawRisks.map((p) => ({
    _id: p._id,
    name: p.name,
    images: p.images,
    quantity: p.quantity,
    stockStatus: getStockStatus(p.quantity),
  }));

  
  res.json({ status: httpStatus.SUCCESS, data: { totalRevenue, ordersCount, avgOrderValue, topSelling, inventoryRisks} });
});

//get /api/brand
const getMyBrand = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;

  res.json({ status: httpStatus.SUCCESS, data: result.brand });
});

//patch /api/brand/:brandId
const updateBrand = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand, bazaar } = result;

  if (!checkBazaarNotEnded(bazaar, next)) return;

  const body = { ...req.body };
  if (req.imagesUrls && req.imagesUrls.length > 0) {
    body.logoUrl = req.imagesUrls[0];
  }

  const updated = await Brand.findByIdAndUpdate(brand._id, body, { new: true });
  res.json({ status: httpStatus.SUCCESS, message: "Brand updated successfully", data: updated });
});

module.exports = { getMyBrand, updateBrand, getDashboard };
