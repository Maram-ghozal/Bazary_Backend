const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    photoUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);