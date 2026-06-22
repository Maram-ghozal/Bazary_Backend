const mongoose = require("mongoose");

const brandReviewSchema = new mongoose.Schema(
    {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required:true,
        },
        brandId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Brand",
            required: true,
        },
    },
    { timestamps: true }
);


brandReviewSchema.index({ user: 1, brand: 1 }, { unique: true });

module.exports = mongoose.model("BrandReview", brandReviewSchema);