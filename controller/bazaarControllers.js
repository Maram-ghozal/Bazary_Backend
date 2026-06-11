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

    return res.json({
        status: httpStatusText.SUCCESS,
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

    const bazaar = await Bazaar.findOne({ userId: req.user.id });

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
    if (req.imagesUrls && req.imagesUrls.length > 0) {
        body.logoUrl = req.imagesUrls[0];
    }

    const updated = await Bazaar.findByIdAndUpdate(bazaar._id, body, { new: true });
    res.json({ status: httpStatusText.SUCCESS, message: "Bazaar updated successfully", data: updated });
});

//get /api/bazaar/brands
const getAllBrands = asyncWrapper(async (req, res, next) => {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

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
                totalOrders:  { $sum: 1 },
                totalRevenue: { $sum: "$totalAmount" }
            }
        }
    ]);

    const productMap = new Map(productStats.map(p => [p._id.toString(), p.totalProducts]));
    const orderMap   = new Map(orderStats.map(o => [o._id.toString(), o]));

    const brands = bazaarBrands.map(b => {
        const brand     = b.brandId;
        const id        = brand._id.toString();
        const orderData = orderMap.get(id) || {};

        return {
            brandId:       id,
            brandName:     brand.brandName,
            brandCategory: brand.brandCategory || null,
            logoUrl:       brand.logoUrl        || null,
            brandType:     b.brandType,
            ownerName:     `${brand.firstName} ${brand.lastName}`,
            ownerEmail:    brand.userId?.email  || null,
            ownerPhone:    brand.phone,
            totalProducts: productMap.get(id)   || 0,
            totalOrders:   orderData.totalOrders  || 0,
            totalRevenue:  orderData.totalRevenue || 0,
            joinedAt:      b.createdAt,
        };
    });

    return res.json({
        status: httpStatusText.SUCCESS,
        data: {
            brands,
            pagination: {
                totalBrands,
                totalPages:  Math.ceil(totalBrands / limit),
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

    const bazaarBrand = await BazaarBrand.findOne({ bazaarId: bazaar._id, brandId})
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

    const orders = await Order.find({
        brandId: brand._id,
        status:  { $in: ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"] }
    })
        .select("totalAmount status paymentMethod items createdAt")
        .sort({ createdAt: -1 });

    const totalRevenue  = orders.reduce((s, o) => s + o.totalAmount, 0);
    const avgOrderValue = orders.length > 0 ? +(totalRevenue / orders.length).toFixed(2) : 0;

    const ordersByStatus = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
    }, {});

    return res.json({
        status: httpStatusText.SUCCESS,
        data: {
            brand: {
                brandId:          brand._id,
                brandName:        brand.brandName,
                brandCategory:    brand.brandCategory    || null,
                brandDescription: brand.brandDescription || null,
                logoUrl:          brand.logoUrl          || null,
                brandType:        bazaarBrand.brandType,
                location:         brand.location         || null,
                ownerName:        `${brand.firstName} ${brand.lastName}`,
                ownerEmail:       brand.userId?.email    || null,
                ownerPhone:       brand.phone,
                ownerWhatsapp:    brand.whatsapp         || null,
                joinedAt:         bazaarBrand.createdAt,
                paidAt:           bazaarBrand.paidAt     || null,
                paidAmount:       bazaarBrand.paidAmount || null,
            },
            stats: {
                totalProducts: products.length,
                totalOrders:   orders.length,
                totalRevenue,
                avgOrderValue,
                ordersByStatus,
            },
            products,
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
        model: "llama-3.3-70b-versatile",
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
    getBazaarAIInsights
};