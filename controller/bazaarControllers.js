const asyncWrapper = require('../middleware/asyncWrapper');
const httpStatusText = require('../utils/httpStatusText');
const appError = require('../utils/appError');
const Bazaar = require('../models/bazaarModel');
const Brand = require('../models/brandModel');
const BazaarBrand = require('../models/bazaarBrandModel');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const WaitingList = require('../models/waitingListModel');
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const { createBrandFromWaitingList } = require('../utils/helperRegisterBrand');
const sendEmail = require('../utils/sendEmail');
const { createStripePayment } = require('../Services/stripeService');


const getDashboard = asyncWrapper(async (req, res, next) => {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { bazaarId } = req.params;

    let bazaar;

    if (bazaarId) {
        bazaar = await Bazaar.findOne({
            _id: bazaarId,
            userId: req.user.id
        });
    } else {
        bazaar = await Bazaar.findOne({
            userId: req.user.id,
            status: { $in: ["UPCOMING", "LIVE"] }
        });
    }

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

    let filteredBazaarBrands = bazaarBrands;
    if (req.query.brandStatus === "blocked") {
        filteredBazaarBrands = bazaarBrands.filter((b) => b.brandId && !b.brandId.isActive);
    } else if (req.query.brandStatus === "active") {
        filteredBazaarBrands = bazaarBrands.filter((b) => b.brandId && b.brandId.isActive);
    }

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

    const brands = filteredBazaarBrands.map(b => {
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
            isActive: brand.isActive,
            status: brand.isActive ? "ACTIVE" : "BLOCKED",
        };
    });

    const totalProducts = productStats.reduce((s, p) => s + p.totalProducts, 0);
    const totalOrders = orderStats.reduce((s, o) => s + o.totalOrders, 0);
    const totalRevenue = orderStats.reduce((s, o) => s + o.totalRevenue, 0);

    return res.json({
        status: httpStatusText.SUCCESS,
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

    const { bazaarId } = req.params;

    let bazaar;

    if (bazaarId) {
        bazaar = await Bazaar.findOne({
            _id: bazaarId,
            userId: req.user.id
        });
    } else {
        bazaar = await Bazaar.findOne({
            userId: req.user.id,
            status: { $in: ["UPCOMING", "LIVE"] }
        });
    }

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

    return res.json({
        status: httpStatusText.SUCCESS,
        data: { brands }
    });
});

const getSalesByHour = asyncWrapper(async (req, res, next) => {

    const { bazaarId } = req.params;

    let bazaar;

    if (bazaarId) {
        bazaar = await Bazaar.findOne({
            _id: bazaarId,
            userId: req.user.id
        });
    } else {
        bazaar = await Bazaar.findOne({
            userId: req.user.id,
            status: { $in: ["UPCOMING", "LIVE"] }
        });
    }

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

        return res.json({
            status: httpStatusText.SUCCESS,
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

    return res.json({
        status: httpStatusText.SUCCESS,
        data: {
            period,
            date: startOfDay.toISOString().split("T")[0],
            salesByHour,
        },
    });

});

const getBazaarControl = asyncWrapper(async (req, res, next) => {

   const { bazaarId } = req.params;

    let bazaar;

    if (bazaarId) {
        bazaar = await Bazaar.findOne({
            _id: bazaarId,
            userId: req.user.id
        });
    } else {
        bazaar = await Bazaar.findOne({
            userId: req.user.id,
            status: { $in: ["UPCOMING", "LIVE"] }
        });
    }

    if (!bazaar) {
        const error = appError.createError("bazaar not found", 404, httpStatusText.FAIL);
        return next(error);
    }

    const brandsCount = await BazaarBrand.countDocuments({ bazaarId: bazaar._id });

    const slotsleft = bazaar.maxBrandCapacity - brandsCount;

    return res.json({
        status: httpStatusText.SUCCESS, data: {
            bazaar,
            brandsCount,
            slotsleft
        }
    });
});

const toggleRegistration = asyncWrapper(async (req, res, next) => {

    const bazaar = await Bazaar.findOne({ userId: req.user.id });

    if (!bazaar) {
        const error = appError.createError("bazaar not found", 404, httpStatusText.FAIL);
        return next(error);
    }

    const { isAcceptingBrands } = req.body;

    bazaar.isAcceptingBrands = isAcceptingBrands;

    await bazaar.save();

    res.json({
        status: httpStatusText.SUCCESS,
        message: "Registration status updated successfully",
        data: {
            isAcceptingBrands: bazaar.isAcceptingBrands
        }
    })
});

const updateAutomationRules = asyncWrapper(async (req, res, next) => {
    const bazaar = await Bazaar.findOne({ userId: req.user.id });

    if (!bazaar) {
        const error = appError.createError("bazaar not found", 404, httpStatusText.FAIL);
        return next(error);
    }

    const { autoCloseOnFull, autoCloseBeforeEvent } = req.body;

    if (autoCloseOnFull !== undefined) {
        bazaar.autoCloseOnFull = autoCloseOnFull;
    }

    if (autoCloseBeforeEvent !== undefined) {
        bazaar.autoCloseBeforeEvent = autoCloseBeforeEvent;
    }

    await bazaar.save();

    res.json({
        status: httpStatusText.SUCCESS,
        message: "Auto close rule updated successfully",
        data: {
            autoCloseOnFull: bazaar.autoCloseOnFull,
            autoCloseBeforeEvent: bazaar.autoCloseBeforeEvent
        }
    });
});

const getBazaar = asyncWrapper(async (req, res, next) => {
    const bazaar = await Bazaar.findOne({ userId: req.user.id });

    if (!bazaar) {
        const error = appError.createError("bazaar not found", 404, httpStatusText.FAIL);
        return next(error);
    }

    res.json({
        status: httpStatusText.SUCCESS,
        data: {
            bazaar
        }
    });
});

const updateBazaar = asyncWrapper(async (req, res, next) => {
    const bazaar = await Bazaar.findOne({ userId: req.user.id });

    if (!bazaar) {
        const error = appError.createError("bazaar not found", 404, httpStatusText.FAIL);
        return next(error);
    }

    const body = { ...req.body };
    if (req.uploadedFiles) {
        if (req.uploadedFiles.logoUrl) body.logoUrl = req.uploadedFiles.logoUrl;
        if (req.uploadedFiles.backgroundImage) body.backgroundImage = req.uploadedFiles.backgroundImage;
    }

    const updated = await Bazaar.findByIdAndUpdate(bazaar._id, body, { new: true });
    res.json({ status: httpStatusText.SUCCESS, message: "Bazaar updated successfully", data: updated });
});

//get /api/bazaar/brands
const getAllBrands = asyncWrapper(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const bazaar = await Bazaar.findOne({ userId: req.user.id });
    if (!bazaar) {
        return next(appError.createError("bazaar not found", 404, httpStatusText.FAIL));
    }

    // كل البراند IDs عشان نعمل aggregate صح
    const allBazaarBrands = await BazaarBrand.find({ bazaarId: bazaar._id });
    const allBrandIds = allBazaarBrands.map(b => b.brandId);
    const totalBrands = allBazaarBrands.length;

    const bazaarBrands = await BazaarBrand.find({ bazaarId: bazaar._id })
        .skip(skip)
        .limit(limit)
        .populate({
            path: "brandId",
            populate: { path: "userId", select: "email" }
        });

    let filteredBazaarBrands = bazaarBrands;
    if (req.query.brandStatus === "blocked") {
        filteredBazaarBrands = bazaarBrands.filter((b) => b.brandId && !b.brandId.isActive);
    } else if (req.query.brandStatus === "active") {
        filteredBazaarBrands = bazaarBrands.filter((b) => b.brandId && b.brandId.isActive);
    }

    const productStats = await Product.aggregate([
        { $match: { brandId: { $in: allBrandIds } } },
        { $group: { _id: "$brandId", totalProducts: { $sum: 1 } } }
    ]);

    const orderStats = await Order.aggregate([
        {
            $match: {
                brandId: { $in: allBrandIds },
                status: { $in: ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"] }
            }
        },
        {
            $group: {
                _id: "$brandId",
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: "$totalAmount" }
            }
        }
    ]);

    const productMap = new Map(productStats.map(p => [p._id.toString(), p.totalProducts]));
    const orderMap = new Map(orderStats.map(o => [o._id.toString(), o]));

    const brands = filteredBazaarBrands.map(b => {
        const brand = b.brandId;
        const id = brand._id.toString();
        const orderData = orderMap.get(id) || {};

        return {
            brandId: id,
            brandName: brand.brandName,
            brandCategory: brand.brandCategory || null,
            logoUrl: brand.logoUrl || null,
            brandType: b.brandType,
            ownerName: `${brand.firstName} ${brand.lastName}`,
            ownerEmail: brand.userId?.email || null,
            ownerPhone: brand.phone,
            totalProducts: productMap.get(id) || 0,
            totalOrders: orderData.totalOrders || 0,
            totalRevenue: orderData.totalRevenue || 0,
            joinedAt: b.createdAt,
            isActive: brand.isActive,
            status: brand.isActive ? "ACTIVE" : "BLOCKED",
        };
    });

    return res.json({
        status: httpStatusText.SUCCESS,
        data: {
            brands,
            pagination: {
                totalBrands,
                totalPages: Math.ceil(totalBrands / limit),
                currentPage: page,
                limit
            }
        }
    });
});

//get /api/bazaar/brands/:brandId
const getOneBrand = asyncWrapper(async (req, res, next) => {
    const { brandId } = req.params;

    const bazaar = await Bazaar.findOne({ userId: req.user.id });
    if (!bazaar) {
        return next(appError.createError("bazaar not found", 404, httpStatusText.FAIL));
    }

    const bazaarBrand = await BazaarBrand.findOne({ bazaarId: bazaar._id, brandId })
        .populate({
            path: "brandId",
            populate: { path: "userId", select: "email" }
        });

    if (!bazaarBrand) {
        return next(appError.createError("brand not found in this bazaar", 404, httpStatusText.FAIL));
    }

    const brand = bazaarBrand.brandId;

    const products = await Product.find({ brandId: brand._id })
        .select("name price priceAfterOffer quantity images isActive createdAt")
        .sort({ createdAt: -1 });

    const productsWithStatus = products.map((p) => ({
        ...p.toObject(),
        status: p.isActive ? "ACTIVE" : "BLOCKED",
    }));

    const orders = await Order.find({
        brandId: brand._id,
        status: { $in: ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"] }
    })
        .select("totalAmount status paymentMethod items createdAt")
        .sort({ createdAt: -1 });

    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const avgOrderValue = orders.length > 0 ? +(totalRevenue / orders.length).toFixed(2) : 0;

    const ordersByStatus = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
    }, {});

    return res.json({
        status: httpStatusText.SUCCESS,
        data: {
            brand: {
                brandId: brand._id,
                brandName: brand.brandName,
                brandCategory: brand.brandCategory || null,
                brandDescription: brand.brandDescription || null,
                logoUrl: brand.logoUrl || null,
                brandType: bazaarBrand.brandType,
                location: brand.location || null,
                ownerName: `${brand.firstName} ${brand.lastName}`,
                ownerEmail: brand.userId?.email || null,
                ownerPhone: brand.phone,
                ownerWhatsapp: brand.whatsapp || null,
                joinedAt: bazaarBrand.createdAt,
                paidAt: bazaarBrand.paidAt || null,
                paidAmount: bazaarBrand.paidAmount || null,
                isActive: brand.isActive,
                status: brand.isActive ? "ACTIVE" : "BLOCKED",
            },
            stats: {
                totalProducts: products.length,
                totalOrders: orders.length,
                totalRevenue,
                avgOrderValue,
                ordersByStatus,
            },
            products: productsWithStatus,
            orders,
        }
    });
});

//bazaar ai
const getBazaarAIInsights = asyncWrapper(async (req, res, next) => {

    const bazaar = await Bazaar.findOne({ userId: req.user.id });

    if (!bazaar) {
        return next(
            AppError.createError("bazaar not found", 404, httpStatusText.FAIL)
        );
    }

    const bazaarBrands = await BazaarBrand.find({ bazaarId: bazaar._id });

    const brandIds = bazaarBrands.map(b => b.brandId);

    const orders = await Order.find({
        brandId: { $in: brandIds },
        status: { $in: ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"] }
    });

    const ordersCount = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const avgOrderValue =
        ordersCount > 0 ? +(totalRevenue / ordersCount).toFixed(2) : 0;

    const brandStats = await Order.aggregate([
        {
            $match: {
                brandId: { $in: brandIds },
                status: { $in: ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"] }
            }
        },
        {
            $group: {
                _id: "$brandId",
                orders: { $sum: 1 },
                revenue: { $sum: "$totalAmount" }
            }
        },
        {
            $sort: { revenue: -1 }
        }
    ]);

    const brands = await BazaarBrand.find({ bazaarId: bazaar._id })
        .populate("brandId");

    const brandMap = new Map(
        brands.map(b => [b.brandId._id.toString(), b.brandId.brandName])
    );

    const formattedBrands = brandStats.map(b => ({
        brand: brandMap.get(b._id.toString()) || "Unknown",
        orders: b.orders,
        revenue: b.revenue
    }));

    const salesByHour = await Order.aggregate([
        {
            $match: {
                brandId: { $in: brandIds }
            }
        },
        {
            $addFields: {
                hour: { $hour: "$createdAt" }
            }
        },
        {
            $group: {
                _id: "$hour",
                orders: { $sum: 1 },
                revenue: { $sum: "$totalAmount" }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]);

    const peakHour =
        salesByHour.reduce((max, h) =>
            h.revenue > (max?.revenue || 0) ? h : max,
            null
        );

    const aiResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                temperature: 0.2,
                max_tokens: 500,
                messages: [
                    {
                        role: "system",
                        content: `
You are an expert Bazaar business intelligence AI.

STRICT RULES:
- Return ONLY JSON
- No markdown
- No explanations
- Be precise and data-driven

OUTPUT FORMAT:
{
  "insights": [
    {
      "title": "",
      "description": ""
    }
  ],
  "recommendations": [
    {
      "title": "",
      "description": ""
    }
  ],
  "alerts": [
    {
      "title": "",
      "description": ""
    }
  ]
}
`
                    },
                    {
                        role: "user",
                        content: `
Bazaar Performance Data:

Total Revenue: ${totalRevenue}
Total Orders: ${ordersCount}
Average Order Value: ${avgOrderValue}

Top Brands:
${JSON.stringify(formattedBrands, null, 2)}

Sales By Hour:
${JSON.stringify(salesByHour, null, 2)}

Peak Hour:
${JSON.stringify(peakHour, null, 2)}

Analyze this bazaar and give insights, risks, and recommendations.
`
                    }
                ]
            })
        }
    );

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
        return next(
            AppError.createError("AI service failed", 500, httpStatusText.ERROR)
        );
    }

    let aiInsights = {
        insights: [],
        recommendations: [],
        alerts: []
    };

    try {
        let content = aiData?.choices?.[0]?.message?.content || "";

        content = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        aiInsights = JSON.parse(content);

    } catch (err) {
        console.log("AI Parse Error:", err);

        aiInsights = {
            insights: [],
            recommendations: [],
            alerts: []
        };
    }

    return res.json({
        status: httpStatusText.SUCCESS,
        data: {
            summary: {
                totalRevenue,
                ordersCount,
                avgOrderValue,
                peakHour: peakHour?._id
            },
            brandPerformance: formattedBrands,
            salesByHour,
            aiInsights
        }
    });
});

const getWaitingList = asyncWrapper(async (req, res, next) => {
    const { bazaarId } = req.params;
    const bazaar = await Bazaar.findOne({ _id: bazaarId, userId: req.user.id });
    if (!bazaar) {
        return next(appError.createError("Bazaar not found", 404, httpStatusText.FAIL));
    }

    const waitingList = await WaitingList.find({ bazaarId: bazaar._id })
        .sort({ createdAt: -1 });

    return res.json({
        status: httpStatusText.SUCCESS,
        data: { waitingList }
    });
});

const approveBrand = asyncWrapper(async (req, res, next) => {
    const { waitingId } = req.params;

    const entry = await WaitingList.findById(waitingId).populate('bazaarId');
    if (!entry) {
        return next(appError.createError("Application not found", 404, httpStatusText.FAIL));
    }

    if (entry.status !== 'PENDING') {
        return next(appError.createError("Application already processed", 400, httpStatusText.FAIL));
    }

    entry.status = 'APPROVED';

    if (entry.brandType === 'OFFLINE') {
        await createBrandFromWaitingList(entry);
        await entry.save();

        await sendEmail({
            email: entry.email,
            subject: 'Application Approved! 🎉',
            message: `
                مبروك ${entry.firstName}!
                طلبك في ${entry.bazaarId.bazaarName} اتوافق عليه.
                هتلاقي بيانات حسابك في إيميل منفصل.
            `
        });
    } else {
        const priceMap = {
            ONLINE: entry.bazaarId.priceOnline,
            HYBRID: entry.bazaarId.priceHybrid
        };
        const amount = priceMap[entry.brandType];


        const { clientSecret } = await createStripePayment({
            userId: null,
            bazaarId: entry.bazaarId._id,
            amount,
            purpose: 'BRAND_SUBSCRIPTION',
            metadata: { waitingListId: entry._id.toString() }
        });

        entry.paymentLink = `${process.env.FRONTEND_URL}/payment/${clientSecret}`;
        await entry.save();

        await sendEmail({
            email: entry.email,
            subject: 'Application Approved - Complete Payment 🎉',
            message: `
                مبروك ${entry.firstName}!
                طلبك في ${entry.bazaarId.bazaarName} اتوافق عليه.
                أكمل الدفع من اللينك ده عشان تتسجل رسمياً:
                ${entry.paymentLink}
                بعد الدفع هتوصلك بيانات حسابك على إيميلك.
            `
        });
    }

    return res.status(200).json({
        status: httpStatusText.SUCCESS,
        message: 'Brand approved successfully',
        data: { entry }
    });
});

const rejectBrand = asyncWrapper(async (req, res, next) => {
    const { waitingId } = req.params;

    const entry = await WaitingList.findById(waitingId).populate('bazaarId');
    if (!entry) {
        return next(appError.createError("Application not found", 404, httpStatusText.FAIL));
    }
    if (entry.status !== 'PENDING') {
        return next(appError.createError("Application already processed", 400, httpStatusText.FAIL));
    }

    entry.status = 'REJECTED';
    await entry.save();

    await sendEmail({
        email: entry.email,
        subject: 'Application Status Update',
        message: `
            مرحباً ${entry.firstName},
            شكراً لاهتمامك بـ ${entry.bazaarId.bazaarName}.
            للأسف طلبك مش مناسب في الوقت ده.
            نتمنى نشوفك في بازارات تانية! 🙏
        `
    });

    return res.status(200).json({
        status: httpStatusText.SUCCESS,
        message: 'Brand rejected successfully',
        data: { entry }
    });
});

//patch /api/bazaar/brands/:brandId
const updateBrandByBazaar = asyncWrapper(async (req, res, next) => {
    const { brandId } = req.params;

    const bazaar = await Bazaar.findOne({ userId: req.user.id });
    if (!bazaar) return next(appError.createError("Bazaar not found", 404, httpStatusText.FAIL));

    const bazaarBrand = await BazaarBrand.findOne({ bazaarId: bazaar._id, brandId });
    if (!bazaarBrand) return next(appError.createError("Brand not found in this bazaar", 404, httpStatusText.FAIL));

    const { email, passwordHash, userId, ...allowedUpdates } = req.body;

    if (req.uploadedFiles) {
        if (req.uploadedFiles.logoUrl) allowedUpdates.logoUrl = req.uploadedFiles.logoUrl;
        if (req.uploadedFiles.backgroundImage) allowedUpdates.backgroundImage = req.uploadedFiles.backgroundImage;
    }

    const updatedBrand = await Brand.findByIdAndUpdate(brandId, allowedUpdates, { new: true });

    if (req.body.brandType) {
        bazaarBrand.brandType = req.body.brandType;
        await bazaarBrand.save();
    }

    return res.json({ status: httpStatusText.SUCCESS, message: "Brand updated successfully", data: updatedBrand });
});

//delete /api/bazaar/brands/:brandId
const removeBrandFromBazaar = asyncWrapper(async (req, res, next) => {
    const { brandId } = req.params;

    const bazaar = await Bazaar.findOne({ userId: req.user.id });
    if (!bazaar) return next(appError.createError("Bazaar not found", 404, httpStatusText.FAIL));

    const bazaarBrand = await BazaarBrand.findOne({ bazaarId: bazaar._id, brandId });
    if (!bazaarBrand) return next(appError.createError("Brand not found in this bazaar", 404, httpStatusText.FAIL));

    await BazaarBrand.findByIdAndDelete(bazaarBrand._id);
    await Product.deleteMany({ brandId, bazaarId: bazaar._id });

    return res.json({ status: httpStatusText.SUCCESS, message: "Brand removed from bazaar successfully" });
});

const addBrandDirectly = asyncWrapper(async (req, res, next) => {
    const bazaar = await Bazaar.findOne({ userId: req.user.id });
    if (!bazaar) return next(appError.createError("Bazaar not found", 404, httpStatusText.FAIL));

    const dataEntry = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        whatsapp: req.body.whatsapp,
        email: req.body.email,
        brandType: req.body.brandType,
        brandName: req.body.brandName,
        brandCategory: req.body.brandCategory,
        brandDescription: req.body.brandDescription,
        location: req.body.location,
        bazaarId: bazaar._id,
    };

    if (req.uploadedFiles) {
        if (req.uploadedFiles.logoUrl) dataEntry.logoUrl = req.uploadedFiles.logoUrl;
        if (req.uploadedFiles.backgroundImage) dataEntry.backgroundImage = req.uploadedFiles.backgroundImage;
    }

    let user = await User.findOne({ email: dataEntry.email });
    let tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    if (!user) {
        user = await User.create({
            email: dataEntry.email,
            passwordHash: hashedPassword,
            role: 'BRAND_OWNER'
        });
    } else {
        user.passwordHash = hashedPassword;
        if (user.role === 'CUSTOMER') {
            user.role = 'BRAND_OWNER';
        }
        await user.save();
    }

    let brand = await Brand.findOne({ userId: user._id });
    if (!brand) {
        brand = await Brand.create({
            userId: user._id,
            firstName: dataEntry.firstName,
            lastName: dataEntry.lastName,
            phone: dataEntry.phone,
            whatsapp: dataEntry.whatsapp,
            email: dataEntry.email,
            brandType: dataEntry.brandType,
            brandName: dataEntry.brandName,
            brandCategory: dataEntry.brandCategory,
            brandDescription: dataEntry.brandDescription,
            logoUrl: dataEntry.logoUrl,
            location: dataEntry.location
        });
    } else {
        brand.firstName = dataEntry.firstName;
        brand.lastName = dataEntry.lastName;
        brand.phone = dataEntry.phone;
        brand.whatsapp = dataEntry.whatsapp;
        brand.email = dataEntry.email;
        brand.brandType = dataEntry.brandType;
        brand.brandName = dataEntry.brandName;
        brand.brandCategory = dataEntry.brandCategory;
        brand.brandDescription = dataEntry.brandDescription;
        if (dataEntry.logoUrl) brand.logoUrl = dataEntry.logoUrl;
        brand.location = dataEntry.location;
        await brand.save();
    }

    await BazaarBrand.create({
        bazaarId: dataEntry.bazaarId,
        brandId: brand._id,
        brandType: dataEntry.brandType,
        paymentId: null,
        paidAt: null
    });

    await sendEmail({
        email: dataEntry.email,
        subject: 'Welcome to Bazaary! 🎉',
        message: `
            تم تسجيلك بنجاح في Bazaary!
            Email: ${dataEntry.email}
            Password: ${tempPassword}
            برجاء تغيير الباسورد بعد أول دخول.
        `
    });

    return res.status(201).json({ status: httpStatusText.SUCCESS, message: "Brand added directly without payment", data: { brand } });
});


const getBazaarHistory = asyncWrapper(async (req, res, next) => {

    const bazaars = await Bazaar.find({
        userId: req.user.id,
        status: "ENDED"
    }).select("bazaarName logoUrl");

    const history = bazaars.map(bazaar => ({
        bazaarId: bazaar._id,
        bazaarName: bazaar.bazaarName,
        logo: bazaar.logoUrl
    }));

    res.json({
        status: httpStatusText.SUCCESS,
        data: {
            bazaars: history
        }
    });
});


module.exports = {
    getDashboard,
    getBrandsComparison,
    getSalesByHour,
    getBazaarControl,
    toggleRegistration,
    updateAutomationRules,
    getBazaar,
    updateBazaar,
    getAllBrands,
    getOneBrand,
    getBazaarAIInsights,
    getWaitingList,
    approveBrand,
    rejectBrand,
    updateBrandByBazaar,
    removeBrandFromBazaar,
    addBrandDirectly,
    getBazaarHistory
};