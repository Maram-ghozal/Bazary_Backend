const asyncWrapper = require('../middleware/asyncWrapper');
const httpStatusText = require('../utils/httpStatusText');
const appError = require('../utils/appError');
const Bazaar = require('../models/bazaarModel');
const Brand = require('../models/brandModel');
const BazaarBrand = require('../models/bazaarBrandModel');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');

const getDashboard = asyncWrapper(async (req, res, next) => {

    req.user = { id: '6a1dbec0f8cf15a70d660886' };

    // pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 1) تأكد من وجود البازار
    const bazaar = await Bazaar.findOne({ userId: req.user.id });

    if (!bazaar) {
        return next(
            appError.createError("bazaar not found", 404, httpStatusText.FAIL)
        );
    }

    // 2) كل البراندات في البازار (بدون pagination) عشان الـ totals والـ brandIds
    const allBazaarBrands = await BazaarBrand.find({ bazaarId: bazaar._id });
    const allBrandIds = allBazaarBrands.map(b => b.brandId);
    const totalBrands = allBazaarBrands.length;

    // 3) البراندات مع pagination + populate البراند واليوزر بتاعه
    const bazaarBrands = await BazaarBrand.find({ bazaarId: bazaar._id })
        .skip(skip)
        .limit(limit)
        .populate({
            path: "brandId",
            populate: {
                path: "userId",
                select: "email"
            }
        });

    // 4) PRODUCTS (ALL BRANDS) - query واحدة
    const productStats = await Product.aggregate([
        { $match: { brandId: { $in: allBrandIds } } },
        { $group: { _id: "$brandId", totalProducts: { $sum: 1 } } }
    ]);

    // 5) ORDERS (ALL BRANDS) - query واحدة
    const orderStats = await Order.aggregate([
        { $match: { brandId: { $in: allBrandIds } } },
        { $unwind: "$items" },
        {
            $group: {
                _id: "$brandId",
                totalOrders: { $addToSet: "$_id" },
                totalRevenue: {
                    $sum: { $multiply: ["$items.price", "$items.quantity"] }
                }
            }
        },
        {
            $project: {
                totalOrders: { $size: "$totalOrders" },
                totalRevenue: 1
            }
        }
    ]);

    // maps
    const productMap = new Map(
        productStats.map(p => [p._id.toString(), p.totalProducts])
    );

    const orderMap = new Map(
        orderStats.map(o => [o._id.toString(), o])
    );

    // 6) BRANDS (PAGINATED)
    const brands = bazaarBrands.map(b => {
        const brand = b.brandId;
        const brandId = brand._id.toString();
        const orderData = orderMap.get(brandId) || {};

        return {
            brandId,
            brandName: brand.brandName,
            ownerName: `${brand.firstName} ${brand.lastName}`,
            ownerEmail: brand.userId.email,
            totalProducts: productMap.get(brandId) || 0,
            totalOrders: orderData.totalOrders || 0,
            totalRevenue: orderData.totalRevenue || 0,
        };
    });

    // 7) GLOBAL TOTALS
    const totalProducts = productStats.reduce((sum, p) => sum + p.totalProducts, 0);
    const totalOrders = orderStats.reduce((sum, o) => sum + o.totalOrders, 0);
    const totalRevenue = orderStats.reduce((sum, o) => sum + o.totalRevenue, 0);

    // 8) RESPONSE
    return res.status(200).json({
        success: true,
        data: {
            brands,
            totals: { totalProducts, totalOrders, totalRevenue },
            pagination: {
                totalBrands,
                totalPages: Math.ceil(totalBrands / limit),
                currentPage: page,
                limit
            }
        }
    });
});

module.exports = { getDashboard };