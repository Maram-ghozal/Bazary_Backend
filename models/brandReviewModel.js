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


brandReviewSchema.index({ userId: 1, brandId: 1 }, { unique: true });

module.exports = mongoose.model("BrandReview", brandReviewSchema);