const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const Admin = require("../models/adminModel");
const Customer = require("../models/customerModel");
const Bazaar = require("../models/bazaarModel");
const Brand = require("../models/brandModel");
const Product = require("../models/productModel");
const Order = require("../models/orderModel");
const BazaarBrand = require("../models/bazaarBrandModel"); 

const getPagination = (req) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const findOrFail = async (Model, id, label, next, populate) => {
  let query = Model.findById(id);
  if (populate) query = query.populate(populate);
  const doc = await query;
  if (!doc) {
    next(AppError.createError(`${label} not found`, 404, httpStatus.FAIL));
    return null;
  }
  return doc;
};


const ROLE_PROFILE_MODEL = {
  CUSTOMER: Customer,
  BRAND_OWNER: Brand,
  BAZAAR_OWNER: Bazaar,
  ADMIN: Admin,
};

const USER_OWN_FIELDS = ["email", "role", "googleId"];

const getProfileForUser = async (user) => {
  const ProfileModel = ROLE_PROFILE_MODEL[user.role];
  if (!ProfileModel) return null;
  return ProfileModel.findOne({ userId: user._id });
};

const getBazaarsForBrand = async (brandId) => {
  const links = await BazaarBrand.find({ brandId }).populate("bazaarId", "bazaarName");
  return links
    .filter((link) => link.bazaarId)
    .map((link) => ({ id: link.bazaarId._id, name: link.bazaarId.bazaarName }));
};

// Adds a clear status label so blocked brands/products are obvious in the response
const withStatusLabel = (doc) => ({
  ...doc,
  status: doc.isActive ? "ACTIVE" : "BLOCKED",
});

//get /api/admin/dashboard
const getDashboardStats = asyncWrapper(async (req, res) => {
  const [usersCount, bazaarsCount, brandsCount, productsCount, ordersCount] =
    await Promise.all([
      User.countDocuments(),
      Bazaar.countDocuments(),
      Brand.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
    ]);

  const revenueAgg = await Order.aggregate([
    { $match: { status: { $ne: "CANCELLED" } } },
    { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
  ]);

  res.json({
    status: httpStatus.SUCCESS,
    data: {
      usersCount,
      bazaarsCount,
      brandsCount,
      productsCount,
      ordersCount,
      totalRevenue: revenueAgg[0]?.totalRevenue || 0,
    },
  });
});

//get /api/admin/dashboard/analytics
// Returns the "who's best" insights for the admin dashboard:
// best bazaars, best brands, best-selling products, most-viewed products,
// orders breakdown by status, and a revenue trend over the last months.
const getDashboardAnalytics = asyncWrapper(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 5, 1), 20);
  const notCancelled = { status: { $ne: "CANCELLED" } };

  const [
    topBazaars,
    topBrands,
    topProductsBySales,
    topProductsByViews,
    ordersByStatusAgg,
    revenueTrendAgg,
  ] = await Promise.all([
    // Best bazaars by revenue / orders count
    Order.aggregate([
      { $match: notCancelled },
      {
        $group: {
          _id: "$bazaarId",
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "bazaars",
          localField: "_id",
          foreignField: "_id",
          as: "bazaar",
        },
      },
      { $unwind: "$bazaar" },
      {
        $project: {
          _id: 0,
          bazaarId: "$_id",
          bazaarName: "$bazaar.bazaarName",
          status: "$bazaar.status",
          totalRevenue: 1,
          totalOrders: 1,
        },
      },
    ]),

    // Best brands by revenue / orders count
    Order.aggregate([
      { $match: notCancelled },
      {
        $group: {
          _id: "$brandId",
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "brands",
          localField: "_id",
          foreignField: "_id",
          as: "brand",
        },
      },
      { $unwind: "$brand" },
      {
        $project: {
          _id: 0,
          brandId: "$_id",
          brandName: "$brand.brandName",
          brandCategory: "$brand.brandCategory",
          totalRevenue: 1,
          totalOrders: 1,
        },
      },
    ]),

    // Best-selling products by quantity sold / revenue generated
    Order.aggregate([
      { $match: notCancelled },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "brands",
          localField: "product.brandId",
          foreignField: "_id",
          as: "brand",
        },
      },
      { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          productName: "$product.name",
          brandName: "$brand.brandName",
          totalSold: 1,
          totalRevenue: 1,
        },
      },
    ]),

    // Most-viewed products (product page opened) - useful for marketing focus
    Product.find({})
      .select("name brandId viewsCount images")
      .populate("brandId", "brandName")
      .sort({ viewsCount: -1 })
      .limit(limit),

    // Orders count grouped by status
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    // Revenue trend for the last 6 months
    Order.aggregate([
      { $match: notCancelled },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 6 },
    ]),
  ]);

  const ordersByStatus = ordersByStatusAgg.reduce((acc, o) => {
    acc[o._id] = o.count;
    return acc;
  }, {});

  const revenueTrend = revenueTrendAgg
    .map((r) => ({
      year: r._id.year,
      month: r._id.month,
      totalRevenue: r.totalRevenue,
      totalOrders: r.totalOrders,
    }))
    .reverse();

  res.json({
    status: httpStatus.SUCCESS,
    data: {
      topBazaars,
      topBrands,
      topProductsBySales,
      topProductsByViews: topProductsByViews.map((p) => ({
        productId: p._id,
        productName: p.name,
        brandName: p.brandId?.brandName || null,
        viewsCount: p.viewsCount,
        images: p.images,
      })),
      ordersByStatus,
      revenueTrend,
    },
  });
});

//get /api/admin/setting
const getMyProfile = asyncWrapper(async (req, res, next) => {
  const user = await User.findById(req.user.id).select(
    "-passwordHash -passwordResetToken -passwordResetExpires"
  );
  if (!user) return next(AppError.createError("User not found", 404, httpStatus.FAIL));

  const profile = (await Admin.findOne({ userId: req.user.id })) || {};

  res.json({
    status: httpStatus.SUCCESS,
    data: {
      id: user._id,
      email: user.email,
      role: user.role,
      fullName: profile.fullName || null,
      phone: profile.phone || null,
      photoUrl: profile.photoUrl || null,
    },
  });
});

//patch /api/admin/setting
const updateMyProfile = asyncWrapper(async (req, res, next) => {
  if (req.body.email || req.body.role || req.body.password) {
    return next(AppError.createError("You can't change your email, role or password from here. Use forgot/reset password to change your password.", 400, httpStatus.FAIL));
  }

  const { fullName, phone } = req.body;

  const profileUpdate = {};
  if (fullName !== undefined) profileUpdate.fullName = fullName;
  if (phone !== undefined) profileUpdate.phone = phone;
  if (req.imagesUrls && req.imagesUrls.length > 0) {
    profileUpdate.photoUrl = req.imagesUrls[0];
  }

  const profile = await Admin.findOneAndUpdate(
    { userId: req.user.id },
    { $set: profileUpdate, $setOnInsert: { userId: req.user.id } },
    { new: true, upsert: true, runValidators: true }
  );

  res.json({ status: httpStatus.SUCCESS, message: "Profile updated successfully", data: profile });
});

//get /api/admin/users
const getAllUsers = asyncWrapper(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    filter.email = { $regex: req.query.search, $options: "i" };
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash -passwordResetToken -passwordResetExpires")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const usersWithProfile = await Promise.all(
    users.map(async (user) => {
      const profile = await getProfileForUser(user);
      return { ...user.toObject(), profile };
    })
  );

  res.json({ status: httpStatus.SUCCESS, data: { total, page, limit, users: usersWithProfile } });
});

//get /api/admin/users/:id
const getOneUser = asyncWrapper(async (req, res, next) => {
  const user = await User.findById(req.params.id).select(
    "-passwordHash -passwordResetToken -passwordResetExpires"
  );
  if (!user) return next(AppError.createError("User not found", 404, httpStatus.FAIL));

  const profile = await getProfileForUser(user);

  res.json({ status: httpStatus.SUCCESS, data: { ...user.toObject(), profile } });
});

//patch /api/admin/users/:id
const updateUser = asyncWrapper(async (req, res, next) => {
  const userFields = {};
  const profileFields = {};

  for (const [key, value] of Object.entries(req.body)) {
    if (["passwordHash", "passwordResetToken", "passwordResetExpires"].includes(key)) continue;
    if (USER_OWN_FIELDS.includes(key)) userFields[key] = value;
    else profileFields[key] = value;
  }

  const user = await User.findByIdAndUpdate(req.params.id, userFields, {
    new: true,
    runValidators: true,
  }).select("-passwordHash -passwordResetToken -passwordResetExpires");

  if (!user) return next(AppError.createError("User not found", 404, httpStatus.FAIL));

  let profile;
  if (Object.keys(profileFields).length > 0) {
    const ProfileModel = ROLE_PROFILE_MODEL[user.role];
    if (!ProfileModel) {
      return next(
        AppError.createError(`No profile model exists for role ${user.role}`, 400, httpStatus.FAIL)
      );
    }
    profile = await ProfileModel.findOneAndUpdate(
      { userId: user._id },
      { $set: profileFields, $setOnInsert: { userId: user._id } },
      { new: true, upsert: true, runValidators: true }
    );
  } else {
    profile = await getProfileForUser(user);
  }

  res.json({ status: httpStatus.SUCCESS, message: "User updated successfully", data: { ...user.toObject(), profile } });
});

//delete /api/admin/users/:id
const deleteUser = asyncWrapper(async (req, res, next) => {
  if (req.params.id === req.user.id) {
    return next(AppError.createError("You cannot delete your own account", 400, httpStatus.FAIL));
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return next(AppError.createError("User not found", 404, httpStatus.FAIL));
  res.json({ status: httpStatus.SUCCESS, message: "User deleted successfully" });
});

//get /api/admin/bazaars
const getAllBazaars = asyncWrapper(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.bazaarName = { $regex: req.query.search, $options: "i" };
  }

  const [bazaars, total] = await Promise.all([
    Bazaar.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Bazaar.countDocuments(filter),
  ]);

  res.json({ status: httpStatus.SUCCESS, data: { total, page, limit, bazaars } });
});

//get /api/admin/bazaars/:id
const getOneBazaar = asyncWrapper(async (req, res, next) => {
  const bazaar = await findOrFail(Bazaar, req.params.id, "Bazaar", next);
  if (!bazaar) return;
  res.json({ status: httpStatus.SUCCESS, data: bazaar });
});

//patch /api/admin/bazaars/:id
const updateBazaar = asyncWrapper(async (req, res, next) => {
  const bazaar = await Bazaar.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!bazaar) return next(AppError.createError("Bazaar not found", 404, httpStatus.FAIL));
  res.json({ status: httpStatus.SUCCESS, message: "Bazaar updated successfully", data: bazaar });
});

//get /api/admin/brands
const getAllBrands = asyncWrapper(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const filter = {};
  if (req.query.search) {
    filter.brandName = { $regex: req.query.search, $options: "i" };
  }
  if (req.query.status === "blocked") filter.isActive = false;
  if (req.query.status === "active") filter.isActive = true;

  const [brands, total] = await Promise.all([
    Brand.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Brand.countDocuments(filter),
  ]);

  const brandsWithBazaars = await Promise.all(
    brands.map(async (brand) => {
      const bazaars = await getBazaarsForBrand(brand._id);
      return withStatusLabel({ ...brand.toObject(), bazaars });
    })
  );

  res.json({ status: httpStatus.SUCCESS, data: { total, page, limit, brands: brandsWithBazaars } });
});

//get /api/admin/brands/:id
const getOneBrand = asyncWrapper(async (req, res, next) => {
  const brand = await findOrFail(Brand, req.params.id, "Brand", next);
  if (!brand) return;

  const bazaars = await getBazaarsForBrand(brand._id);

  res.json({ status: httpStatus.SUCCESS, data: withStatusLabel({ ...brand.toObject(), bazaars }) });
});

//patch /api/admin/brands/:id
const updateBrand = asyncWrapper(async (req, res, next) => {
  const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!brand) return next(AppError.createError("Brand not found", 404, httpStatus.FAIL));
  res.json({ status: httpStatus.SUCCESS, message: "Brand updated successfully", data: withStatusLabel(brand.toObject()) });
});

//delete /api/admin/brands/:id
const deleteBrand = asyncWrapper(async (req, res, next) => {
  const brand = await Brand.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!brand) return next(AppError.createError("Brand not found", 404, httpStatus.FAIL));

  await Product.updateMany({ brandId: brand._id }, { isActive: false });

  res.json({ status: httpStatus.SUCCESS, message: "Brand blocked successfully", data: withStatusLabel(brand.toObject()) });
});

//get /api/admin/products
const getAllProducts = asyncWrapper(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const filter = {};
  if (req.query.brandId) filter.brandId = req.query.brandId;
  if (req.query.search) {
    filter.name = { $regex: req.query.search, $options: "i" };
  }
  if (req.query.status === "blocked") filter.isActive = false;
  if (req.query.status === "active") filter.isActive = true;

  const sort = req.query.sort === "views" ? { viewsCount: -1 } : { createdAt: -1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("brandId", "brandName") 
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  const productsWithBazaars = await Promise.all(
    products.map(async (product) => {
      const bazaars = product.brandId ? await getBazaarsForBrand(product.brandId._id) : [];
      return withStatusLabel({ ...product.toObject(), bazaars });
    })
  );

  res.json({ status: httpStatus.SUCCESS, data: { total, page, limit, products: productsWithBazaars } });
});

//get /api/admin/products/:id
const getOneProduct = asyncWrapper(async (req, res, next) => {
  const product = await findOrFail(Product, req.params.id, "Product", next, "brandId");
  if (!product) return;

  const bazaars = product.brandId ? await getBazaarsForBrand(product.brandId._id) : [];

  res.json({ status: httpStatus.SUCCESS, data: withStatusLabel({ ...product.toObject(), bazaars }) });
});

//patch /api/admin/products/:id
const updateProduct = asyncWrapper(async (req, res, next) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) return next(AppError.createError("Product not found", 404, httpStatus.FAIL));
  res.json({ status: httpStatus.SUCCESS, message: "Product updated successfully", data: withStatusLabel(product.toObject()) });
});

//delete /api/admin/products/:id
const deleteProduct = asyncWrapper(async (req, res, next) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!product) return next(AppError.createError("Product not found", 404, httpStatus.FAIL));
  res.json({ status: httpStatus.SUCCESS, message: "Product blocked successfully", data: withStatusLabel(product.toObject()) });
});

//get /api/admin/orders
const getAllOrders = asyncWrapper(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.bazaarId) filter.bazaarId = req.query.bazaarId;
  if (req.query.brandId) filter.brandId = req.query.brandId;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("customerId", "fullName phone")
      .populate("brandId", "brandName")
      .populate("bazaarId", "bazaarName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({ status: httpStatus.SUCCESS, data: { total, page, limit, orders } });
});

//get /api/admin/orders/:id
const getOneOrder = asyncWrapper(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate("customerId", "fullName phone")
    .populate("brandId", "brandName")
    .populate("bazaarId", "bazaarName");
  if (!order) return next(AppError.createError("Order not found", 404, httpStatus.FAIL));
  res.json({ status: httpStatus.SUCCESS, data: order });
});

module.exports = {
  getDashboardStats,
  getDashboardAnalytics,
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  getOneUser,
  updateUser,
  deleteUser,
  getAllBazaars,
  getOneBazaar,
  updateBazaar,
  getAllBrands,
  getOneBrand,
  updateBrand,
  deleteBrand,
  getAllProducts,
  getOneProduct,
  updateProduct,
  deleteProduct,
  getAllOrders,
  getOneOrder
};