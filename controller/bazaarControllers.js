const asyncWrapper = require('../middleware/asyncWrapper');
const httpStatusText = require('../utils/httpStatusText');
const appError = require('../utils/appError');
const Bazaar = require('../models/bazaarModel');
const Brand = require('../models/brandModel');
const BazaarBrand = require('../models/bazaarBrandModel');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');

const getDashboard = asyncWrapper(async (req, res, next) => {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const bazaar = await Bazaar.findOne({ userId: req.user.id });

    if (!bazaar) {
        const error = appError.createError("bazaar not found", 404, httpStatusText.FAIL);
        return next(error);
    }

    const allBazaarBrands = await BazaarBrand.find({
        bazaarId: bazaar._id
    });

    const allBrandIds = allBazaarBrands.map(b => b.brandId);

    const totalBrands = allBazaarBrands.length;

    const bazaarBrands = await BazaarBrand.find({
        bazaarId: bazaar._id
    })
        .skip(skip)
        .limit(limit)
        .populate({
            path: "brandId",
            populate: {
                path: "userId",
                select: "email"
            }
        });

    const productStats = await Product.aggregate([
        {
            $match: {
                brandId: { $in: allBrandIds }
            }
        },
        {
            $group: {
                _id: "$brandId",
                totalProducts: { $sum: 1 }
            }
        }
    ]);

    const orderStats = await Order.aggregate([
        {
            $match: {
                brandId: { $in: allBrandIds }
            }
        },
        {
            $group: {
                _id: "$brandId",
                totalOrders: { $addToSet: "$_id" },
                totalRevenue: { $sum: "$totalAmount" }
            }
        },
        {
            $project: {
                totalOrders: { $size: "$totalOrders" },
                totalRevenue: 1
            }
        }
    ]);

    const productMap = new Map(
        productStats.map(p => [p._id.toString(), p.totalProducts])
    );

    const orderMap = new Map(
        orderStats.map(o => [o._id.toString(), o])
    );

    const brands = bazaarBrands.map(b => {
        const brand = b.brandId;
        const id = brand._id.toString();
        const orderData = orderMap.get(id) || {};

        return {
            brandId: id,
            brandName: brand.brandName,
            ownerName: `${brand.firstName} ${brand.lastName}`,
            ownerEmail: brand.userId.email,
            totalProducts: productMap.get(id) || 0,
            totalOrders: orderData.totalOrders || 0,
            totalRevenue: orderData.totalRevenue || 0,
        };
    });

    const totalProducts = productStats.reduce((s, p) => s + p.totalProducts, 0);
    const totalOrders = orderStats.reduce((s, o) => s + o.totalOrders, 0);
    const totalRevenue = orderStats.reduce((s, o) => s + o.totalRevenue, 0);

    return res.status(200).json({
        success: true,
        data: {
            brands,
            totals: {
                totalProducts,
                totalOrders,
                totalRevenue
            },
            pagination: {
                totalBrands,
                totalPages: Math.ceil(totalBrands / limit),
                currentPage: page,
                limit
            }
        }
    });
});

const getBrandsComparison = asyncWrapper(async (req, res, next) => {

    const bazaar = await Bazaar.findOne({ userId: req.user.id });

    if (!bazaar) {
        const error = appError.createError("bazaar not found", 404, httpStatusText.FAIL);
        return next(error);
    }
    const bazaarBrands = await BazaarBrand.find({ bazaarId: bazaar._id })
        .populate({ path: "brandId" });

    const allBrandIds = bazaarBrands.map(b => b.brandId._id);

    const orderStats = await Order.aggregate([
        {
            $match: {
                brandId: { $in: allBrandIds }
            }
        },
        {
            $group: {
                _id: "$brandId",
                totalOrders: { $addToSet: "$_id" },
                totalRevenue: { $sum: "$totalAmount" }
            }
        },
        {
            $project: {
                totalOrders: { $size: "$totalOrders" },
                totalRevenue: 1
            }
        }
    ]);

    const orderMap = new Map(
        orderStats.map(o => [o._id.toString(), o])
    );

    const brands = bazaarBrands.map(b => {
        const brand = b.brandId;
        const brandId = brand._id.toString();
        const orderData = orderMap.get(brandId) || {};

        return {
            brandId,
            brandName: brand.brandName,
            totalOrders: orderData.totalOrders || 0,
            totalRevenue: orderData.totalRevenue || 0,
        };
    });

    brands.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return res.status(200).json({
        success: true,
        data: { brands }
    });
});

const getSalesByHour = asyncWrapper(async (req, res, next) => {
 
    const bazaar = await Bazaar.findOne({ userId: req.user.id });

    if (!bazaar) {
        const error = appError.createError("bazaar not found", 404, httpStatusText.FAIL);
        return next(error);
    }

    const { period = "full", date, hour } = req.query;

    const targetDate = date ? new Date(date) : new Date();

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const periodRanges = {
        morning: { start: 6, end: 11 },
        afternoon: { start: 12, end: 17 },
        evening: { start: 18, end: 23 },
        full: { start: 0, end: 23 },
    };

    const { start: hourStart, end: hourEnd } =
        periodRanges[period] || periodRanges.full;

    const bazaarBrands = await BazaarBrand.find({ bazaarId: bazaar._id });


    const brandIds = bazaarBrands.map((b) => b.brandId);

    
    if (hour !== undefined) {

        const result = await Order.aggregate([
            {
                $match: {
                    brandId: { $in: brandIds },
                    createdAt: {
                        $gte: startOfDay,
                        $lte: endOfDay,
                    },
                },
            },

            {
                $addFields: {
                    hour: { $hour: "$createdAt" },
                },
            },

            {
                $match: {
                    hour: Number(hour),
                },
            },

            {
                $group: {
                    _id: null,
                    revenue: { $sum: "$totalAmount" },
                    orders: { $sum: 1 },
                },
            },
        ]);

        const data = result[0] || {
            revenue: 0,
            orders: 0,
        };

        return res.status(200).json({
            success: true,
            data: {
                hour: Number(hour),
                period,
                ...data,
            },
        });
    }

  
    const salesByHour = await Order.aggregate([
        {
            $match: {
                brandId: { $in: brandIds },
                createdAt: {
                    $gte: startOfDay,
                    $lte: endOfDay,
                },
            },
        },

        {
            $addFields: {
                hour: { $hour: "$createdAt" },
            },
        },

        {
            $match: {
                hour: { $gte: hourStart, $lte: hourEnd },
            },
        },

        {
            $group: {
                _id: "$hour",
                revenue: { $sum: "$totalAmount" },
                orders: { $sum: 1 },
            },
        },

        {
            $sort: { _id: 1 },
        },

        {
            $project: {
                _id: 0,
                hour: "$_id",
                revenue: 1,
                orders: 1,
            },
        },
    ]);

    return res.status(200).json({
        success: true,
        data: {
            period,
            date: startOfDay.toISOString().split("T")[0],
            salesByHour,
        },
    });

});


module.exports = {
    getDashboard,
    getBrandsComparison,
    getSalesByHour
};