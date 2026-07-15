const mongoose = require("mongoose");
const ProductReview = require("../models/productReviewModel");

const getRatingsMap = async (productIds = []) => {
  const ids = productIds
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(id));

  if (ids.length === 0) return new Map();

  const stats = await ProductReview.aggregate([
    { $match: { productId: { $in: ids } } },
    {
      $group: {
        _id: "$productId",
        avgRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  const map = new Map();
  stats.forEach((s) => {
    map.set(s._id.toString(), {
      avgRating: Math.round(s.avgRating * 10) / 10,
      ratingCount: s.ratingCount,
    });
  });
  return map;
};


const getRatingFor = (ratingsMap, productId) =>
  ratingsMap.get(productId.toString()) || { avgRating: 0, ratingCount: 0 };

module.exports = { getRatingsMap, getRatingFor };