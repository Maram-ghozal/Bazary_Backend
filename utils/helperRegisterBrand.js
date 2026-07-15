const User = require("../models/userModel");
const Brand = require("../models/brandModel");
const BazaarBrand = require("../models/bazaarBrandModel");
const WaitingList = require("../models/waitingListModel");
const bcrypt = require("bcryptjs");
const sendEmail = require("./sendEmail");

const createBrandFromWaitingList = async (entry, paymentId = null, sendCredentials = true) => {
  let user = await User.findOne({ email: entry.email });
  let tempPassword = "";

  if (!user) {
    tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    user = await User.create({
      email: entry.email,
      passwordHash: hashedPassword,
      role: "BRAND_OWNER",
    });
  } else {
    tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    user.passwordHash = hashedPassword;
    if (user.role === "CUSTOMER") {
      user.role = "BRAND_OWNER";
    }
    await user.save();
  }

  let brand = await Brand.findOne({ userId: user._id });
  if (!brand) {
    brand = await Brand.create({
      userId: user._id,
      firstName: entry.firstName,
      lastName: entry.lastName,
      email: entry.email,
      brandType: entry.brandType,
      phone: entry.phone,
      whatsapp: entry.whatsapp,
      brandName: entry.brandName,
      brandCategory: entry.brandCategory,
      brandDescription: entry.brandDescription,
      logoUrl: entry.logoUrl,
      backgroundImage: entry.backgroundImage,
      location: entry.location,
      socialMediaLinks: entry.socialMediaLinks
    });
  } else {
    brand.firstName = entry.firstName;
    brand.lastName = entry.lastName;
    brand.email = entry.email;
    brand.brandType = entry.brandType;
    brand.phone = entry.phone;
    brand.whatsapp = entry.whatsapp;
    brand.brandName = entry.brandName;
    brand.brandCategory = entry.brandCategory;
    brand.brandDescription = entry.brandDescription;
    brand.logoUrl = entry.logoUrl;
    brand.backgroundImage = entry.backgroundImage;
    brand.location = entry.location;
    brand.socialMediaLinks = entry.socialMediaLinks;
    await brand.save();
  }

  await BazaarBrand.create({
    bazaarId: entry.bazaarId,
    brandId: brand._id,
    brandType: entry.brandType,
    status: "APPROVED",
    paymentId: paymentId || null,
    paidAt: paymentId ? new Date() : null,
  });

  if (sendCredentials) {
    await sendEmail({
      email: entry.email,
      subject: "Welcome to Bazaary! 🎉",
      message: `
              تم تسجيلك بنجاح في Bazaary!
              Email: ${entry.email}
              Password: ${tempPassword}
              برجاء تغيير الباسورد بعد أول دخول.
          `,
    });
  }

  return { user, brand };
};

module.exports = { createBrandFromWaitingList };