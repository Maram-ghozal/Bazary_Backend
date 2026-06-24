const mongoose = require("mongoose");

const productReviewSchema = new mongoose.Schema(
    {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: {
            type: String
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
    },
    { timestamps: true }
);

productReviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model("ProductReview", productReviewSchema);