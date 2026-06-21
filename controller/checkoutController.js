const asyncWrapper = require("../middleware/asyncWrapper");
const appError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Cart = require("../models/cartModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Customer = require("../models/customerModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const Bazaar = require("../models/bazaarModel");
const { createStripePayment } = require("../Services/stripeService");

const checkout = asyncWrapper(async (req, res, next) => {
  const { paymentMethod, fullName, phone, address, governate, city } = req.body;

  if (!paymentMethod || !["CASH", "VISA"].includes(paymentMethod)) {
    return next(appError.createError("paymentMethod must be CASH or VISA", 400, httpStatus.FAIL));
  }

  const cart = await Cart.findOne({ customerId: req.user.id }).populate("items.productId");

  if (!cart || cart.items.length === 0) {
    return next(appError.createError("Cart is empty", 400, httpStatus.FAIL));
  }

  let customer = await Customer.findOne({ userId: req.user.id });
  if (!customer) {
    if (!fullName || !phone || !address || !governate || !city) {
      return next(appError.createError("Please complete your profile or provide fullName, phone, address, governate, city", 400, httpStatus.FAIL));
    }
    customer = await Customer.create({
      userId: req.user.id,
      fullName,
      phone,
      address,
      governate,
      city,
    });
  }

  const now = new Date();
  const bazaarIds = [...new Set(cart.items.map((i) => i.bazaarId.toString()))];
  const liveBazaars = await Bazaar.find({
    _id: { $in: bazaarIds },
    startDate: { $lte: now },
    endDate: { $gte: now },
  });
  const liveBazaarIds = new Set(liveBazaars.map((b) => b._id.toString()));

  for (const id of bazaarIds) {
    if (!liveBazaarIds.has(id)) {
      return next( appError.createError("One of the bazaars in your cart is no longer live. Please remove its items and try again.", 400, httpStatus.FAIL ) );
    }
  }

  const groupMap = new Map();
  for (const item of cart.items) {
    const product = item.productId; 

    if (!product || !product.isActive) {
      return next(
        appError.createError(`Product ${item.productId} is no longer available`, 400, httpStatus.FAIL)
      );
    }
    if (product.quantity < item.quantity) {
      return next(
        appError.createError(`Not enough stock for ${product.name}`, 400, httpStatus.FAIL)
      );
    }

    const relation = await BazaarBrand.findOne({ brandId: item.brandId, bazaarId: item.bazaarId });
    if (!relation) {
      return next(
        appError.createError(`Brand is not part of this bazaar`, 400, httpStatus.FAIL)
      );
    }

    const groupKey = `${item.bazaarId.toString()}_${item.brandId.toString()}`;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, { bazaarId: item.bazaarId, brandId: item.brandId, items: [] });
    }
    groupMap.get(groupKey).items.push({
      productId: product._id,
      quantity: item.quantity,
      price: product.priceAfterOffer ?? product.price,
    });
  }

  const createdOrders = [];
  const clientSecrets = [];

  for (const { bazaarId, brandId, items } of groupMap.values()) {
    const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const order = await Order.create({
      customerId: customer._id,
      brandId,
      bazaarId,
      items,
      totalAmount,
      paymentMethod,
      status: "PENDING",
    });

    if (paymentMethod === "CASH") {
      for (const item of items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -item.quantity },
        });
      }
      createdOrders.push({ order, requiresPayment: false });
    }

    if (paymentMethod === "VISA") {
      const { paymentId, clientSecret } = await createStripePayment({
        userId: req.user.id,
        bazaarId,
        amount: totalAmount,
        purpose: "ORDER_CHECKOUT",
        metadata: { orderId: order._id.toString() },
      });

      order.paymentId = paymentId;
      await order.save();

      createdOrders.push({ order, requiresPayment: true });
      clientSecrets.push({ orderId: order._id, bazaarId, brandId, clientSecret });
    }
  }

  await Cart.findOneAndUpdate(
    { customerId: req.user.id },
    { items: [], totalAmount: 0 }
  );

  res.status(201).json({ status: httpStatus.SUCCESS, data: { orders: createdOrders, ...(paymentMethod === "VISA" && { clientSecrets }) } });
});

module.exports = { checkout };
