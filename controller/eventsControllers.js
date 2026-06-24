const asyncWrapper = require("../middleware/asyncWrapper");
const httpStatusText = require("../utils/httpStatusText");
const appError = require("../utils/appError");
const Customer = require("../models/customerModel");
const Bazaar = require("../models/bazaarModel");
const Brand = require("../models/brandModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const ProductReview = require("../models/productReviewModel");
const BrandReview = require("../models/brandReviewModel");
const syncBazaarStatus = require("../utils/syncBazaarStatus");
const mongoose=require("mongoose")

const getLiveBazaars = asyncWrapper(async (req, res, next) => {
  const now = new Date();

  await syncBazaarStatus(now);

  const liveBazaars = await Bazaar.find({
    status: "LIVE",
  });

  res.json({
    status: httpStatusText.SUCCESS,
    data: liveBazaars,
  });
});


const getLiveStats = asyncWrapper(async (req, res, next) => {
  const now = new Date();

  await syncBazaarStatus(now);

  const liveBazaars = await Bazaar.find({ status: "LIVE" }).select(
    "bazaarName",
  );
  const liveBazaarIds = liveBazaars.map((b) => b._id);

  const bazaarBrands = await BazaarBrand.find({
    bazaarId: { $in: liveBazaarIds },
  }).populate("brandId", "brandName");

  const soldAgg = await Order.aggregate([
    {
      $match: {
        bazaarId: { $in: liveBazaarIds },
        status: { $ne: "CANCELLED" },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: { bazaarId: "$bazaarId", brandId: "$brandId" },
        totalSold: { $sum: "$items.quantity" },
      },
    },
  ]);

  const soldMap = new Map(
    soldAgg.map((s) => [
      `${s._id.bazaarId}_${s._id.brandId}`,
      s.totalSold,
    ]),
  );

  let totalBrandsCount = 0;
  let totalProductsSoldCount = 0;

  const bazaars = liveBazaars.map((bazaar) => {
    const brandsInThisBazaar = bazaarBrands.filter(
      (bb) => bb.bazaarId.toString() === bazaar._id.toString(),
    );

    const brands = brandsInThisBazaar.map((bb) => {
      const productsSoldCount =
        soldMap.get(`${bazaar._id}_${bb.brandId?._id}`) || 0;

      return {
        brandId: bb.brandId?._id,
        brandName: bb.brandId?.brandName,
        productsSoldCount,
      };
    });

    const bazaarProductsSoldCount = brands.reduce(
      (sum, b) => sum + b.productsSoldCount,
      0,
    );

    totalBrandsCount += brands.length;
    totalProductsSoldCount += bazaarProductsSoldCount;

    return {
      bazaarId: bazaar._id,
      bazaarName: bazaar.bazaarName,
      brandsCount: brands.length,
      productsSoldCount: bazaarProductsSoldCount,
      brands,
    };
  });

  res.json({
    status: httpStatusText.SUCCESS,
    data: {
      liveBazaarsCount: liveBazaars.length,
      totalBrandsCount,
      totalProductsSoldCount,
      bazaars,
    },
  });
});


const getAllLiveBrands = asyncWrapper(async (req, res, next) => {
  const now = new Date();

  await syncBazaarStatus(now);

  const liveBazaars = await Bazaar.find({ status: "LIVE" }).select("bazaarName");
  const liveBazaarIds = liveBazaars.map((b) => b._id);

  if (liveBazaarIds.length === 0) {
    return res.json({ status: httpStatusText.SUCCESS, data: [] });
  }

  const bazaarNameMap = new Map(
    liveBazaars.map((b) => [b._id.toString(), b.bazaarName])
  );

  const bazaarBrands = await BazaarBrand.find({
    bazaarId: { $in: liveBazaarIds },
  }).populate("brandId");

  const result = bazaarBrands
    .filter((bb) => bb.brandId && bb.brandId.isActive)
    .map((bb) => ({
      ...bb.brandId.toObject(),
      bazaarId: bb.bazaarId,
      bazaarName: bazaarNameMap.get(bb.bazaarId.toString()),
    }));

  res.json({ status: httpStatusText.SUCCESS, count: result.length, data: result });
});


const getAllLiveProducts = asyncWrapper(async (req, res, next) => {
  const now = new Date();

  await syncBazaarStatus(now);

  const liveBazaars = await Bazaar.find({ status: "LIVE" }).select(
    "bazaarName"
  );
  const liveBazaarIds = liveBazaars.map((b) => b._id);

  if (liveBazaarIds.length === 0) {
    return res.json({ status: httpStatusText.SUCCESS, data: [] });
  }

  const bazaarBrands = await BazaarBrand.find({
    bazaarId: { $in: liveBazaarIds },
  }).populate("brandId", "brandName isActive");

  const bazaarNameMap = new Map(
    liveBazaars.map((b) => [b._id.toString(), b.bazaarName])
  );

  const brandIds = bazaarBrands
    .filter((bb) => bb.brandId)
    .map((bb) => bb.brandId._id);

  const products = await Product.find({
    brandId: { $in: brandIds },
    isActive: true,
  }).lean();

  const productsByBrand = new Map();
  for (const product of products) {
    const key = product.brandId.toString();
    if (!productsByBrand.has(key)) productsByBrand.set(key, []);
    productsByBrand.get(key).push(product);
  }

  const result = [];
  for (const bb of bazaarBrands) {
    if (!bb.brandId || !bb.brandId.isActive) continue;

    const brandId = bb.brandId._id.toString();
    const brandProducts = productsByBrand.get(brandId) || [];

    for (const product of brandProducts) {
      result.push({
        ...product,
        brandId: bb.brandId._id,
        brandName: bb.brandId.brandName,
        bazaarId: bb.bazaarId,
        bazaarName: bazaarNameMap.get(bb.bazaarId.toString()),
      });
    }
  }

  res.json({ status: httpStatusText.SUCCESS, count: result.length, data: result });
});


const getTopSellingProducts = asyncWrapper(async (req, res, next) => {
  const now = new Date();

  await syncBazaarStatus(now);

  const limit = Number(req.query.limit) || 10;

  const liveBazaars = await Bazaar.find({ status: "LIVE" }).select(
    "bazaarName"
  );
  const liveBazaarIds = liveBazaars.map((b) => b._id);

  if (liveBazaarIds.length === 0) {
    return res.json({ status: httpStatusText.SUCCESS, data: [] });
  }

  const bazaarNameMap = new Map(
    liveBazaars.map((b) => [b._id.toString(), b.bazaarName])
  );

  const topAgg = await Order.aggregate([
    {
      $match: {
        bazaarId: { $in: liveBazaarIds },
        status: { $ne: "CANCELLED" },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: { productId: "$items.productId", bazaarId: "$bazaarId" },
        totalSold: { $sum: "$items.quantity" },
        totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit },
  ]);

  const productIds = topAgg.map((p) => p._id.productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .populate("brandId", "brandName")
    .lean();

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const result = topAgg
    .map((entry) => {
      const product = productMap.get(entry._id.productId.toString());
      if (!product) return null;
      const bazaarId = entry._id.bazaarId;
      return {
        ...product,
        bazaarId,
        bazaarName: bazaarNameMap.get(bazaarId.toString()),
        totalSold: entry.totalSold,
        totalRevenue: entry.totalRevenue,
      };
    })
    .filter(Boolean);

  res.json({ status: httpStatusText.SUCCESS, data: result });
});


const getUpcomingBazaars = asyncWrapper(async (req, res, next) => {
  const now = new Date();

  await syncBazaarStatus(now);

  const upcomingBazaars = await Bazaar.find({
    status: "UPCOMING",
  });

  res.json({
    status: httpStatusText.SUCCESS,
    data: upcomingBazaars,
  });
});


const getBazaarBrand = asyncWrapper(async (req, res, next) => {
  const { bazaarId } = req.params;
  const brands = await BazaarBrand.find({
    bazaarId,
  }).populate("brandId");

  res.json({
    status: httpStatusText.SUCCESS,
    data: {
      bazaar: req.bazaar,
      brands: brands.map(item => item.brandId)
    }
  });

});

const getBrandProducts = asyncWrapper(async (req, res, next) => {
  const { bazaarId, brandId } = req.params;

  const relation = await BazaarBrand.findOne({
    bazaarId,
    brandId,
  });

  if (!relation) {
    const error = appError.createError(
      "brand not in this bazaar",
      404,
      httpStatusText.FAIL,
    );
    return next(error);
  }

  const products = await Product.find({
    brandId,
  });

  res.json({
    status: httpStatusText.SUCCESS,
    data: products,
  });
});


const getProductDetails = asyncWrapper(async (req, res, next) => {
  const { bazaarId, brandId, productId } = req.params;

  const relation = await BazaarBrand.findOne({
    bazaarId,
    brandId,
  });

  if (!relation) {
    const error = appError.createError(
      "brand not in this bazaar",
      404,
      httpStatusText.FAIL,
    );
    return next(error);
  }

  const product = await Product.findOne({
    _id: productId,
    brandId: brandId,
  });

  if (!product) {
    const error = appError.createError(
      "product not found",
      404,
      httpStatusText.FAIL,
    );
    return next(error);
  }

  res.json({
    status: httpStatusText.SUCCESS,
    data: product,
  });
});


const addOrUpdateProductReview = asyncWrapper(async (req, res, next) => {

  const { rating, comment } = req.body;
  const { productId } = req.params;

  let review = await ProductReview.findOne({
    userId: req.user.id,
    productId: productId,
  });

  if (review) {
    review.rating = rating;
    review.comment = comment;

    await review.save();

    return res.json({
      status: httpStatusText.SUCCESS,
      message: "Product review updated",
      review,
    });
  }

  review = await ProductReview.create({
    userId: req.user.id,
    productId: productId,
    rating,
    comment,
  });

  res.status(201).json({
    status: httpStatusText.SUCCESS,
    message: "Product review created",
    review,
  });
});


const getProductReview = asyncWrapper(async (req, res, next) => {

  const { productId } = req.params;


  const reviews = await ProductReview.find({ productId: productId })
    .populate("userId", "name");


  const avg = await ProductReview.aggregate([
   { $match: { productId: new mongoose.Types.ObjectId(productId) }},
    {
      $group: {
        _id: "$productId",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  res.json({
    status: httpStatusText.SUCCESS,
    reviews,
    avgRating: avg[0]?.avgRating || 0,
    ratingCount: avg[0]?.count || 0,
  });

});


const addOrUpdateBrandReview = asyncWrapper(async (req, res, next) => {

  const { rating } = req.body;
  const { brandId } = req.params;

  let review = await BrandReview.findOne({
    userId: req.user.id,
    brandId: brandId,
  });


  if (review) {
    review.rating = rating;

    await review.save();

    return res.json({
      status: httpStatusText.SUCCESS,
      message: "Brand review updated",
      review,
    });
  }


  review = await BrandReview.create({
    userId: req.user.id,
    brandId: brandId,
    rating,
  });

  return res.status(201).json({
    status: httpStatusText.SUCCESS,
    message: "Brand review created",
    review,
  });
});


const getBrandReview = asyncWrapper(async (req, res, next) => {
  const { brandId } = req.params;


  const reviews = await BrandReview.find({ brandId: brandId })
    .populate("userId", "name");


  const avg = await BrandReview.aggregate([
    { $match: { brandId: new mongoose.Types.ObjectId(brandId) } },
    {
      $group: {
        _id: "$brandId",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  return res.json({
    status: httpStatusText.SUCCESS,
    reviews,
    avgRating: avg[0]?.avgRating || 0,
    ratingCount: avg[0]?.count || 0,
  });
});

module.exports = {
  getLiveBazaars,
  getAllLiveBrands,
  getAllLiveProducts,
  getTopSellingProducts,
  getLiveStats,
  getUpcomingBazaars,
  getBazaarBrand,
  getBrandProducts,
  getProductDetails,
  addOrUpdateProductReview,
  getProductReview,
  addOrUpdateBrandReview,
  getBrandReview
};
