const asyncWrapper = require("../middleware/asyncWrapper");
const appError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Wishlist = require("../models/WishlistModel");
const Product = require("../models/productModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const Bazaar = require('../models/bazaarModel');

const getOwnerQuery = (req) => {
  if (req.user?.id) return { customerId: req.user.id };
  const guestId = req.headers["x-guest-id"];
  if (guestId) return { guestId };
  return null;
};

const getOwnerData = (req) => {
  if (req.user?.id) return { customerId: req.user.id };
  const guestId = req.headers["x-guest-id"];
  if (guestId) return { guestId };
  return null;
};

//get /api/events/wishlist
const getWishlist = asyncWrapper(async (req, res, next) => {
  const query = getOwnerQuery(req);
  if (!query) {
    return next( appError.createError("Login required or x-guest-id must be provided.", 401, httpStatus.FAIL ) );
  }

  let wishlist = await Wishlist.findOne(query)
    .populate("items.productId", "name images price priceAfterOffer isActive")
    .populate("items.brandId", "brandName")
    .populate("items.bazaarId", "bazaarName status");

  if (!wishlist) {
    wishlist = { ...query, items: [] };
  }

  res.json({ status: httpStatus.SUCCESS, data: wishlist });
});

//post /api/events/wishlist
const addToWishlist = asyncWrapper(async (req, res, next) => {
  const ownerData = getOwnerData(req);
  if (!ownerData) {
    return next( appError.createError( "Login required or x-guest-id must be provided.", 401, httpStatus.FAIL ) );
  }

  const { productId, bazaarId } = req.body;
  if (!productId || !bazaarId) {
    return next( appError.createError("productId and bazaarId are required", 400, httpStatus.FAIL));
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next( appError.createError("Product not available", 404, httpStatus.FAIL) );
  }

  const brandInBazaar = await BazaarBrand.findOne({
    brandId: product.brandId,
    bazaarId,
  });
  if (!brandInBazaar) {
    return next(appError.createError("This brand is not part of this bazaar", 400, httpStatus.FAIL));
  }

  const bazaar = await Bazaar.findById(bazaarId);
    if (!bazaar || bazaar.status !== 'LIVE') {
  return next(appError.createError('This bazaar is not live', 400, httpStatus.FAIL));
   }

  const query = ownerData.customerId
    ? { customerId: ownerData.customerId }
    : { guestId: ownerData.guestId };

  let wishlist = await Wishlist.findOne(query);
  if (!wishlist) {
    wishlist = new Wishlist({ ...ownerData, items: [] });
  }

  const alreadyExists = wishlist.items.some(
    (item) =>
      item.productId.toString() === productId &&
      item.bazaarId.toString() === bazaarId,
  );
  if (alreadyExists) {
    return res.json({
      status: httpStatus.SUCCESS,
      message: "Already in wishlist",
      data: wishlist,
    });
  }

  wishlist.items.push({
    productId: product._id,
    brandId: product.brandId,
    bazaarId,
  });
  await wishlist.save();

  res.status(201).json({tatus: httpStatus.SUCCESS, message: "Added to wishlist", data: wishlist });
});

//delete /api/events/wishlist/:productId?bazaarId
const removeFromWishlist = asyncWrapper(async (req, res, next) => {
  const query = getOwnerQuery(req);
  if (!query) {
    return next(appError.createError("Login required or x-guest-id must be provided.", 401, httpStatus.FAIL));
  }

  const { productId } = req.params;
  const { bazaarId } = req.query;

  const wishlist = await Wishlist.findOne(query);
  if (!wishlist) {
    return next(appError.createError("Wishlist not found", 404, httpStatus.FAIL));
  }

  const before = wishlist.items.length;

  wishlist.items = wishlist.items.filter((item) => {
    if (bazaarId) {
      return !(
        item.productId.toString() === productId &&
        item.bazaarId.toString() === bazaarId
      );
    }
    return item.productId.toString() !== productId;
  });

  if (wishlist.items.length === before) {
    return next(
      appError.createError("Item not found in wishlist", 404, httpStatus.FAIL),
    );
  }

  await wishlist.save();
  res.json({status: httpStatus.SUCCESS, message: "Removed from wishlist", data: wishlist});
});

//post /api/events/wishlist/merge
const mergeWishlist = asyncWrapper(async (req, res, next) => {
  if (!req.user?.id) {
    return next(appError.createError("يجب تسجيل الدخول", 401, httpStatus.FAIL));
  }

  const customerId = req.user.id;
  const guestId = req.headers["x-guest-id"];

  if (!guestId) {
    const wishlist = await Wishlist.findOne({ customerId })
      .populate("items.productId", "name images price priceAfterOffer isActive")
      .populate("items.brandId", "brandName")
      .populate("items.bazaarId", "bazaarName status");
    return res.json({
      status: httpStatus.SUCCESS,
      data: wishlist || { customerId, items: [] },
    });
  }

  const guestWishlist = await Wishlist.findOne({ guestId });
  const customerWishlist =
    (await Wishlist.findOne({ customerId })) ||
    new Wishlist({ customerId, items: [] });

  if (guestWishlist?.items?.length) {
    for (const guestItem of guestWishlist.items) {
      const alreadyExists = customerWishlist.items.some(
        (item) =>
          item.productId.toString() === guestItem.productId.toString() &&
          item.bazaarId.toString() === guestItem.bazaarId.toString(),
      );
      if (!alreadyExists) {
        customerWishlist.items.push(guestItem);
      }
    }
    await customerWishlist.save();
    await Wishlist.deleteOne({ guestId });
  }

  const populated = await Wishlist.findOne({ customerId })
    .populate("items.productId", "name images price priceAfterOffer isActive")
    .populate("items.brandId", "brandName")
    .populate("items.bazaarId", "bazaarName status");

  res.json({status: httpStatus.SUCCESS, message: "Wishlist merged successfully", data: populated });
});

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  mergeWishlist,
};