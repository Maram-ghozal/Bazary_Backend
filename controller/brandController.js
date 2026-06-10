require('dotenv').config();
const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const Brand = require("../models/brandModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const { getBrandWithBazaar, checkBazaarNotEnded, getStockStatus } = require("../utils/helperBrand");

//get /api/brand/dashboard
const getDashboard = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand, bazaar } = result;
 
  const bazaarEnded = bazaar?.status === "ENDED";
  //get all orders of the btand without status cancelled
  const orders = await Order.find({
    brandId: brand._id,
    status: { $in: ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"] }
  });

  const ordersCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgOrderValue = ordersCount > 0 ? +(totalRevenue / ordersCount).toFixed(2) : 0;

  // Top Selling Products
   const topSelling = await Order.aggregate([
    { $match: { brandId: brand._id, status: { $in: ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"] } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.productId", totalSold: { $sum: "$items.quantity" } } },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $project: { _id: 0 //hideId 
    , totalSold: 1, name: "$product.name", images: "$product.images", quantity: "$product.quantity", price: "$product.price" } }
  ]);

  const rawRisks = await Product.find({ brandId: brand._id, isActive: true, quantity: { $lte: 10 } })
    .select("name images quantity")
    .sort({ quantity: 1 }) // from lowest to highest quantity
    .limit(10);
 
  const inventoryRisks = rawRisks.map((p) => ({
    _id: p._id,
    name: p.name,
    images: p.images,
    quantity: p.quantity,
    stockStatus: getStockStatus(p.quantity),
  }));

  
  res.json({ status: httpStatus.SUCCESS, data: { totalRevenue, ordersCount, avgOrderValue, topSelling, inventoryRisks} });
});

//get /api/brand
const getMyBrand = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;

  res.json({ status: httpStatus.SUCCESS, data: result.brand });
});

//patch /api/brand/:brandId
const updateBrand = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;
  const { brand, bazaar } = result;

  if (!checkBazaarNotEnded(bazaar, next)) return;

  const body = { ...req.body };
  if (req.imagesUrls && req.imagesUrls.length > 0) {
    body.logoUrl = req.imagesUrls[0];
  }

  const updated = await Brand.findByIdAndUpdate(brand._id, body, { new: true });
  res.json({ status: httpStatus.SUCCESS, message: "Brand updated successfully", data: updated });
});

const suggestDescription = asyncWrapper(async (req, res, next) => {
  const result = await getBrandWithBazaar(req.user.id, next);
  if (!result) return;

  const { brand } = result;
  const { regenerate } = req.query;

  const products = await Product.find({ brandId: brand._id, isActive: true })
    .select("name")
    .limit(10);

  const productNames = products.map(p => p.name).join(", ") || "Not specified";

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.9,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content: "You are a creative branding assistant. Generate very short, high-quality brand descriptions (1-2 sentences only). Always return valid text."
          },
          {
            role: "user",
            content: `
Write a short brand description in 1-2 sentences.

Brand Name: ${brand.brandName}
Category: ${brand.brandCategory || "Not specified"}
Type: ${brand.brandType || "Not specified"}
Location: ${brand.location || "Not specified"}
Products: ${productNames}

${regenerate ? "IMPORTANT: Generate a completely different version from previous ones." : ""}

Rules:
- Only return the description
- No explanations
- No quotes
- No extra text
`
          }
        ]
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.log("Groq error:", data);
    return next(AppError.createError("AI service failed", 500, httpStatus.ERROR));
  }

  res.json({ status: httpStatus.SUCCESS, data: { suggestion: data.choices?.[0]?.message?.content?.trim() } });
});

module.exports = { getMyBrand, updateBrand, getDashboard, suggestDescription};
