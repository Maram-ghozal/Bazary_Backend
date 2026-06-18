const asyncWrapper = require("../middleware/asyncWrapper");
const appError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Cart = require("../models/cartModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Customer = require("../models/customerModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const { createStripePayment } = require("../Services/stripeService");

const checkout = asyncWrapper(async (req, res, next) => {
  const { paymentMethod, fullName, phone, address, governate, city } = req.body;

  if (!paymentMethod || !["CASH", "VISA"].includes(paymentMethod)) {
    return next(appError.createError("paymentMethod must be CASH or VISA", 400, httpStatus.FAIL));
  }

  const cart = await Cart.findOne({ customerId: req.user.id }).populate( "items.productId" );

  if (!cart || cart.items.length === 0) {
    return next(appError.createError("Cart is empty", 400, httpStatus.FAIL));
  }

  let customer = await Customer.findOne({ userId: req.user.id });
  if (!customer) {
    if (!fullName || !phone || !address || !governate || !city) {
      return next( appError.createError( "Please complete your profile or provide fullName, phone, address, governate, city", 400, httpStatus.FAIL ));
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

  const bazaarIds = [...new Set(cart.items.map((i) => i.bazaarId.toString()))];
  if (bazaarIds.length > 1) {
    return next( appError.createError("Cart contains items from multiple bazaars. Please clear cart and shop from one bazaar.", 400, httpStatus.FAIL) );
  }
  const bazaarId = cart.items[0].bazaarId;

  const brandMap = new Map(); 
  for (const item of cart.items) {
    const product = item.productId; // populated

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

    const relation = await BazaarBrand.findOne({ brandId: item.brandId, bazaarId });
    if (!relation) {
      return next(
        appError.createError(`Brand is not part of this bazaar`, 400, httpStatus.FAIL)
      );
    }

    const brandKey = item.brandId.toString();
    if (!brandMap.has(brandKey)) brandMap.set(brandKey, []);
    brandMap.get(brandKey).push({
      productId: product._id,
      quantity: item.quantity,
      price: product.priceAfterOffer ?? product.price,
    });
  }

  const createdOrders = [];
  const clientSecrets = [];

  for (const [brandId, items] of brandMap) {
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
      clientSecrets.push({ orderId: order._id, clientSecret });
    }
  }

  await Cart.findOneAndUpdate(
    { customerId: req.user.id },
    { items: [], totalAmount: 0 }
  );

  res.status(201).json({ status: httpStatus.SUCCESS, data: { orders: createdOrders, ...(paymentMethod === "VISA" && { clientSecrets }) } });
});

module.exports = { checkout };
