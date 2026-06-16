const asyncWrapper = require("../middleware/asyncWrapper");
const httpStatusText = require("../utils/httpStatusText");
const appError = require("../utils/appError");
const Customer = require("../models/customerModel");
const Bazaar = require("../models/bazaarModel");
const Brand = require("../models/brandModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const syncBazaarStatus = require("../utils/syncBazaarStatus");

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
    data:{
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

const createOrder = asyncWrapper(async (req, res, next) => {
  const { bazaarId, brandId } = req.params;
  const { items, paymentMethod, fullName, phone, address, governate, city } =
    req.body;

  const relation = await BazaarBrand.findOne({ bazaarId, brandId });
  if (!relation) {
    return next(
      appError.createError(
        "brand not in this bazaar",
        404,
        httpStatusText.FAIL,
      ),
    );
  }

  let totalAmount = 0;
  const resolvedItems = [];

  for (const item of items) {
    const product = await Product.findOne({
      _id: item.productId,
      brandId,
      isActive: true,
    });

    if (!product) {
      return next(
        appError.createError(
          `Product ${item.productId} not found`,
          404,
          httpStatusText.FAIL,
        ),
      );
    }
    if (product.quantity < item.quantity) {
      return next(
        appError.createError(
          `Not enough stock for ${product.name}`,
          400,
          httpStatusText.FAIL,
        ),
      );
    }

    const price = product.priceAfterOffer ?? product.price;
    totalAmount += price * item.quantity;

    resolvedItems.push({
      productId: product._id,
      quantity: item.quantity,
      price,
    });
  }

  let customer;
  if (req.user) {
    customer = await Customer.findOne({ userId: req.user.id });

    if (!customer) {
      return next(
        appError.createError(
          "Customer profile not found",
          404,
          httpStatusText.FAIL,
        ),
      );
    }
  } else {
    if (!fullName || !phone || !address || !governate || !city) {
      return next(
        appError.createError(
          "All fields are required for guest checkout",
          400,
          httpStatusText.FAIL,
        ),
      );
    }
    customer = await Customer.findOne({ phone, userId: null });
    if (!customer) {
      customer = await Customer.create({
        fullName,
        phone,
        address,
        governate,
        city,
      });
    }
  }

  const order = await Order.create({
    customerId: customer._id,
    brandId,
    bazaarId,
    items: resolvedItems,
    totalAmount,
    paymentMethod,
    status: "PENDING",
  });

  if (paymentMethod === "CASH") {
    for (const item of resolvedItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { quantity: -item.quantity },
      });
    }
  }

  if (paymentMethod === "VISA") {
    const { createStripePayment } = require("../Services/stripeService");

    const { paymentId, clientSecret } = await createStripePayment({
      userId: req.user?.id || customer._id,
      bazaarId,
      amount: totalAmount,
      purpose: "ORDER_CHECKOUT",
      metadata: { orderId: order._id.toString() },
    });

    order.paymentId = paymentId;
    await order.save();

    return res
      .status(201)
      .json({
        status: httpStatusText.SUCCESS,
        data: { order, clientSecret, requiresPayment: true },
      });
  }

  res
    .status(201)
    .json({
      status: httpStatusText.SUCCESS,
      data: { order, requiresPayment: false },
    });
});



module.exports = {
  getLiveBazaars,
  getLiveStats,
  getUpcomingBazaars,
  getBazaarBrand,
  getBrandProducts,
  getProductDetails,
  createOrder,
};
