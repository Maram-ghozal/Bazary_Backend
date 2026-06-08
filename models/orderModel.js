const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }, // مش محتاجين _id لكل item
);

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    bazaarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bazaar",
      required: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: "Order must have at least one item",
      },
    },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "PENDING",
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "VISA"],
      required: true,
    },
  },
  { timestamps: true },
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
