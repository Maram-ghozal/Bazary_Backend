const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Order = require("../models/orderModel");
const Customer = require("../models/customerModel");
const { getBrandWithBazaar, checkBazaarNotEnded } = require("../utils/helperBrand");

//get /api/brand/orders
const getAllOrders = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand } = result;

  const { status } = req.query;
  const brandOrdersFilter  = { brandId: brand._id };
  if (status) brandOrdersFilter .status = status.toUpperCase();

  const orders = await Order.find(brandOrdersFilter)
    .populate({
      path: "customerId",
      select: "fullName phone address governate city",
      populate: { path: "userId", select: "email" },
    })
    .populate("items.productId", "name images")
    .sort({ createdAt: -1 });

  const mapped = orders.map((order) => ({
    orderId: order._id,
    customer: {
      customerId: order.customerId?._id,
      fullName: order.customerId?.fullName || null,
      email: order.customerId?.userId?.email || null,
      phone: order.customerId?.phone || null,
      address: order.customerId?.address || null,
      governate: order.customerId?.governate || null,
      city: order.customerId?.city || null,
    },
    status: order.status,
    paymentMethod: order.paymentMethod,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      productId: item.productId?._id,
      name: item.productId?.name,
      images: item.productId?.images,
      quantity: item.quantity,
      price: item.price,
      subTotal: item.price * item.quantity,
    })),
  }));

  res.json({ status: httpStatus.SUCCESS, data: { total: mapped.length, orders: mapped } });
});

//get /api/brand/orders/:orderId
const getOneOrder = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand } = result;

  const order = await Order.findOne({ _id: req.params.orderId, brandId: brand._id })
    .populate({ path: "customerId", select: "fullName phone address governate city",
      populate: { path: "userId", select: "email"  }
    })
    .populate({ path: "customerId", populate: { path: "userId", select: "email" } })
    .populate("items.productId", "name images");

  if (!order) {
    return next(AppError.createError("Order not found", 404, httpStatus.FAIL));
  }

  const orderData = {
    orderId: order._id,
    customer: {
      fullName: order.customerId?.fullName,
      email: order.customerId?.userId?.email || null,
      phone: order.customerId?.phone || null,
      address: order.customerId?.address || null,
      governate: order.customerId?.governate || null,
      city: order.customerId?.city || null,
    },
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      productId: item.productId?._id,
      name: item.productId?.name,
      images: item.productId?.images,
      quantity: item.quantity,
      price: item.price,
      subTotal: item.price * item.quantity,
    })),
  };

  res.json({status: httpStatus.SUCCESS,data: orderData,});
});

//patch /api/brand/orders/:orderId/status
const updateOrderStatus = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand, bazaar } = result;
 
  if (!checkBazaarNotEnded(bazaar, next)) return;

  const { status } = req.body;

  const allowedStatuses = [
    "PENDING",
    "PREPARING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
  ];

  if (!allowedStatuses.includes(status)) {
    return next(AppError.createError("Invalid status", 400, httpStatus.FAIL));
  }

  const order = await Order.findOne({_id: req.params.orderId, brandId: brand._id,});

  if (!order) {
    return next(
      AppError.createError("Order not found", 404, httpStatus.FAIL)
    );
  }

  const validTransitions = {
    PENDING: ["PREPARING", "CANCELLED"],
    PREPARING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  if (!validTransitions[order.status].includes(status)) {
    return next(AppError.createError(`Cannot change status from ${order.status} to ${status}`, 400, httpStatus.FAIL));
  }

  order.status = status;
  await order.save();

  res.json({ status: httpStatus.SUCCESS, message: "Order status updated", data: order,
  });
});

//get /api/orders/my-orders  (customer)
const getMyOrders = asyncWrapper(async (req, res, next) => {
  const customer = await Customer.findOne({ userId: req.user.id });
 
  if (!customer) {
    return res.json({
      status: httpStatus.SUCCESS,
      data: {
        totalOrders: 0,
        totalSpent: 0,
        byBrand: [],
        byBazaar: [],
        orders: [],
      },
    });
  }
 
  const orders = await Order.find({ customerId: customer._id })
    .populate("brandId", "brandName logoUrl")
    .populate("bazaarId", "bazaarName")
    .populate("items.productId", "name images price priceAfterOffer")
    .sort({ createdAt: -1 });
 
  let totalSpent = 0;
  const brandMap = new Map();
  const bazaarMap = new Map();
 
  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
 
    totalSpent += order.totalAmount;
 
    const brandId = order.brandId?._id?.toString();
    if (brandId) {
      if (!brandMap.has(brandId)) {
        brandMap.set(brandId, {
          brandId,
          brandName: order.brandId.brandName,
          logoUrl: order.brandId.logoUrl,
          ordersCount: 0,
          totalSpent: 0,
        });
      }
      const b = brandMap.get(brandId);
      b.ordersCount += 1;
      b.totalSpent += order.totalAmount;
    }
 
    const bazaarId = order.bazaarId?._id?.toString();
    if (bazaarId) {
      if (!bazaarMap.has(bazaarId)) {
        bazaarMap.set(bazaarId, {
          bazaarId,
          bazaarName: order.bazaarId.bazaarName,
          ordersCount: 0,
          totalSpent: 0,
        });
      }
      const bz = bazaarMap.get(bazaarId);
      bz.ordersCount += 1;
      bz.totalSpent += order.totalAmount;
    }
  }
 
  const formattedOrders = orders.map((order) => ({
    orderId: order._id,
    brandId: order.brandId?._id,
    brandName: order.brandId?.brandName,
    bazaarId: order.bazaarId?._id,
    bazaarName: order.bazaarId?.bazaarName,
    status: order.status,
    paymentMethod: order.paymentMethod,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      productId: item.productId?._id,
      name: item.productId?.name,
      images: item.productId?.images,
      quantity: item.quantity,
      price: item.price,
    })),
  }));
 
  res.json({
    status: httpStatus.SUCCESS,
    data: {
      totalOrders: orders.length,
      totalSpent,
      byBrand: Array.from(brandMap.values()),
      byBazaar: Array.from(bazaarMap.values()),
      orders: formattedOrders,
    },
  });
});

module.exports = { getAllOrders, getOneOrder, updateOrderStatus, getMyOrders };