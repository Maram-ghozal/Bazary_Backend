const asyncWrapper = require("../middleware/asyncWrapper");
const appError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Cart = require("../models/cartModel");
const Product = require("../models/productModel");
const BazaarBrand = require("../models/bazaarBrandModel");

const getCart = asyncWrapper(async (req, res, next) => {
  const customerId = req.user.id;

  let cart = await Cart.findOne({ customerId })
    .populate('items.productId', 'name images price priceAfterOffer')
    .populate('items.brandId', 'brandName');

  if (!cart) {
    cart = await Cart.create({ customerId, items: [] });
  }

  res.json({ status: httpStatus.SUCCESS, data: cart });
});

const addToCart = asyncWrapper(async (req, res, next) => {
  if (!req.user?.id) {
    return next(appError.createError("Unauthorized", 401, httpStatus.FAIL));
  }

  const { productId, quantity = 1 } = req.body;
  const customerId = req.user.id;

  const product = await Product.findById(productId);

  if (!product || !product.isActive) {
    return next(appError.createError("Product not available", 400, httpStatus.FAIL));
  }

  if (product.quantity < quantity) {
    return next(appError.createError("Insufficient stock available", 400, httpStatus.FAIL));
  }

  const bazaarBrandLink = await BazaarBrand.findOne({ brandId: product.brandId, status: "APPROVED" });

  if (!bazaarBrandLink) {
    return next(appError.createError("This brand is not linked to any active bazaar", 400, httpStatus.FAIL));
  }

  const bazaarId = bazaarBrandLink.bazaarId;

  let cart = await Cart.findOne({ customerId });
  if (!cart) cart = new Cart({ customerId, items: [] });

  const existingItem = cart.items.find(
    item => item.productId.toString() === productId
  );

  const currentPrice = product.priceAfterOffer || product.price;

  if (existingItem) {
    const newQty = existingItem.quantity + quantity;

    if (product.quantity < newQty) {
      return next(appError.createError("Cannot add more of this item, stock limit reached", 400, httpStatus.FAIL));
    }

    existingItem.quantity = newQty;
    existingItem.price = currentPrice;
  } else {
    cart.items.push({
      productId: product._id,
      brandId: product.brandId,
      bazaarId,
      quantity,
      price: currentPrice
    });
  }

  await cart.save();

  res.status(200).json({ status: httpStatus.SUCCESS, message: "Added to cart", data: cart });
});

const updateCartItem = asyncWrapper(async (req, res, next) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  const customerId = req.user.id;

  if (quantity < 1) {
    return next(appError.createError("Quantity must be at least 1", 400, httpStatus.FAIL));
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(appError.createError("Product is no longer available", 400, httpStatus.FAIL));
  }

  if (product.quantity < quantity) {
    return next(appError.createError(`Only ${product.quantity} items left in stock`, 400, httpStatus.FAIL));
  }

  const cart = await Cart.findOne({ customerId });
  if (!cart) return next(appError.createError("Cart not found", 404, httpStatus.FAIL));

  const item = cart.items.find(i => i.productId.toString() === productId);
  if (!item) return next(appError.createError("Item not in cart", 404, httpStatus.FAIL));

  item.quantity = quantity;
  item.price = product.priceAfterOffer || product.price;

  await cart.save();
  res.json({ status: httpStatus.SUCCESS, data: cart });
});

const removeFromCart = asyncWrapper(async (req, res, next) => {
  const { productId } = req.params;

  const cart = await Cart.findOneAndUpdate(
    { customerId: req.user.id },
    {
      $pull: {
        items: { productId: productId }
      }
    },
    { new: true }
  );

  if (!cart) {
    return next(appError.createError("Cart not found", 404, httpStatus.FAIL));
  }

  cart.totalAmount = cart.items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  await cart.save();

  res.json({ status: httpStatus.SUCCESS, message: "Item removed from cart successfully", data: cart });
});

const clearCart = asyncWrapper(async (req, res, next) => {
  await Cart.findOneAndUpdate(
    { customerId: req.user.id },
    { items: [] ,
      totalAmount: 0
     }
  );
  res.json({ status: httpStatus.SUCCESS, message: "Cart cleared successfully" });
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};