const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Order = require("../models/orderModel");
const { getBrandWithBazaar, checkBazaarNotEnded } = require("../utils/helperBrand");

//get /api/brand/orders
const getAllOrders = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand } = result;

  const { status } = req.query;
  const brandOrdersFilter  = { brandId: brand._id };
  if (status) brandOrdersFilter .status = status.toUpperCase();

  const orders = await Order.find(brandOrdersFilter )
    .populate("customerId", "fullName")
    .sort({ createdAt: -1 });

  res.json({ status: httpStatus.SUCCESS, data: { total: orders.length, orders } });
});

//get /api/brand/orders/:orderId
const getOneOrder = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand } = result;

  const order = await Order.findOne({ _id: req.params.orderId, brandId: brand._id })
    .populate("customerId", "fullName")
    .populate({ path: "customerId", populate: { path: "userId", select: "email"} })
    .populate("items.productId", "name images");

  if (!order) {
    return next(AppError.createError("Order not found", 404, httpStatus.FAIL));
  }

  const orderData = {
    orderId: order._id,
    customerName: order.customerId.fullName,
    customerEmail: order.customerId?.userId?.email,
    // customerPhone: order.customerId?.phone || null,
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

module.exports = { getAllOrders, getOneOrder, updateOrderStatus };