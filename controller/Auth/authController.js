const appError = require("../../utils/appError");
const httpStatus = require("../../utils/httpStatusText");
const User = require("../../models/userModel");
const Customer = require("../../models/customerModel");
const Bazaar = require("../../models/bazaarModel");
const Payment = require("../../models/paymentModel");
const Brand = require("../../models/brandModel");
const BazaarBrand = require("../../models/bazaarBrandModel");
const WaitingList = require('../../models/waitingListModel');
const generateToken = require("../../utils/generateWebToken");
const { createStripePayment } = require("../../Services/stripeService");
const { getPackage, getAllPackages } = require("../../config/packages");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const asyncWrapper = require("../../middleware/asyncWrapper");
const sendEmail = require("../../utils/sendEmail");

// 1---------register customer
const register = asyncWrapper(async (req, res, next) => {
  const { email, password, fullName, phone, address, governate, city } =
    req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = appError.createError(
      "This user is already existing",
      400,
      httpStatus.FAIL,
    );
    return next(error);
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  const newUser = await User.create({
    email,
    passwordHash: hashedPassword,
    role: "CUSTOMER",
  });
  await Customer.create({
    userId: newUser._id,
    fullName,
    phone,
    address,
    governate,
    city,
  });
  const tokens = generateToken({
    id: newUser._id,
    role: newUser.role,
  });
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // بيسمح بتبادل الكوكيز في نفس النطاق بشكل آمن
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.status(201).json({
    status: httpStatus.SUCCESS,
    message: "user registered successfully",
    data: {
      user: {
        id: newUser._id,
        email: newUser.email,
        fullName: fullName,
        phone: phone,
        address: address,
        governate: governate,
        city: city,
        role: newUser.role,
      },
      accessToken: tokens.accessToken,
    },
  });
});
const login = asyncWrapper(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    const error = appError.createError(
      "Please provide email and password",
      400,
      httpStatus.FAIL,
    );
    return next(error);
  }
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = appError.createError(
      "Incorrect email or password",
      401,
      httpStatus.FAIL,
    );
    return next(error);
  }
  const tokens = generateToken({
    id: user._id,
    role: user.role,
  });
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // بيسمح بتبادل الكوكيز في نفس النطاق بشكل آمن
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.status(200).json({
    status: httpStatus.SUCCESS,
    message: "user loggedin successfully",
    data: {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      accessToken: tokens.accessToken,
    },
  });
});

const logout = asyncWrapper(async (req, res, next) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.status(200).json({
    status: httpStatus.SUCCESS,
    message: "Logged out successfully",
    data: null,
  });
});

// forget password
const forgotPassword = asyncWrapper(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      appError.createError(
        "There is no user with this email address",
        404,
        httpStatus.FAIL,
      ),
    );
  }

  // ✅ توليد OTP رقمي 6 خانات
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // ✅ تخزينه مشفر في الداتابيز
  user.passwordResetToken = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const message = `Your password reset code is: ${otp}\n\nValid for 10 minutes only.\nIf you didn't request this, ignore this email.`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Bazaary - Password Reset OTP",
      message: message,
    });

    res.status(200).json({
      status: httpStatus.SUCCESS,
      message: "OTP sent to email successfully!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      appError.createError(
        "Error sending email. Try again later!",
        500,
        httpStatus.ERROR,
      ),
    );
  }
});

//reset
const resetPassword = asyncWrapper(async (req, res, next) => {
  const { otp, password } = req.body;

  if (!otp || !password) {
    return next(
      appError.createError(
        "Please provide otp and new password",
        400,
        httpStatus.FAIL,
      ),
    );
  }

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedOtp,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      appError.createError(
        "OTP is invalid or has expired",
        400,
        httpStatus.FAIL,
      ),
    );
  }

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(password, salt);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: httpStatus.SUCCESS,
    message: "Password reset successfully!",
  });
});

//2----------------register bazaar
const registerBazaar = asyncWrapper(async (req, res, next) => {
  const {
    email,
    fullName,
    phone,
    whatsapp,
    bazaarName,
    bazaarDescription,
    address,
    googleMapsLink,
    startDate,
    endDate,
    packageId,
    paymentMethod,
    socialMediaLinks
  } = req.body;
  const logoUrl = req.uploadedFiles?.logoUrl || null;
  const backgroundImage = req.uploadedFiles?.backgroundImage || null;

    const selectedPackage = getPackage(packageId);
  if (!selectedPackage) {
    return next(
      appError.createError(
        "Invalid package. Choose: STARTER, BUSINESS, or PREMIUM",
        400,
        httpStatus.FAIL,
      ),
    );
  }


  let user = await User.findOne({ email });
  let isNewUser = false;
  let tempPassword = "";

  if (user) {
    if (user.role === "CUSTOMER") {
      user.role = "BAZAAR_OWNER";
      await user.save();
    }
  } else {
    tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    user = await User.create({
      email,
      passwordHash: hashedPassword,
      role: "BAZAAR_OWNER",
    });
    isNewUser = true;
  }

  if (isNewUser) {
  }

  const newBazaar = await Bazaar.create({
    userId: user._id,
    fullName,
    phone,
    whatsapp,
    bazaarName,
    bazaarDescription,
    logoUrl,
    backgroundImage,
    address,
    googleMapsLink,
    startDate,
    endDate,
    type: selectedPackage.type,
    packageId: selectedPackage.id,
    maxBrandCapacity: selectedPackage.maxBrandCapacity,
    topSearch: selectedPackage.topSearch,
    aiAssistant: selectedPackage.aiAssistant,
    paidAmount: selectedPackage.price,
    paymentMethod,
    status: "PENDING_PAYMENT",
    isPaid: false,
    socialMediaLinks
  });

  const { paymentId, clientSecret } = await createStripePayment({
    userId: user._id,
    bazaarId: newBazaar._id,
    amount:selectedPackage.price,
    purpose: "BAZAAR_SUBSCRIPTION",
        metadata: {
      packageId: selectedPackage.id,
      packageName: selectedPackage.name,
    },

  });

  if (isNewUser) {
    await Payment.findByIdAndUpdate(paymentId, {
      pendingCredentials: { email: user.email, tempPassword },
    });
  }

  res.status(201).json({
    status: httpStatus.SUCCESS,
    message: "Bazaar registered successfully. Pending payment.",
    data: {
      bazaar: newBazaar,
       package: selectedPackage,
      paymentId,
      clientSecret,
      amount:selectedPackage.price,
      isNewUser,
    },
  });
});

//3------------- register brand
const registerBrand = asyncWrapper(async (req, res, next) => {
    const { bazaarId } = req.params;
    const {
        email, firstName, lastName, phone, whatsapp,
        brandName, brandCategory, brandDescription, location, brandType,socialMediaLinks
    } = req.body;
    const logoUrl = req.uploadedFiles?.logoUrl || null;
    const backgroundImage = req.uploadedFiles?.backgroundImage || null;

    // 1. التحقق من البازار
    const bazaar = await Bazaar.findById(bazaarId);
    if (!bazaar) {
        return next(appError.createError("Bazaar not found", 404, httpStatus.FAIL));
    }
    if (!bazaar.isAcceptingBrands) {
        return next(appError.createError("This bazaar is not accepting brands", 400, httpStatus.FAIL));
    }

const approvedBrandsCount = await BazaarBrand.countDocuments({
    bazaarId,
    status: 'APPROVED'
});

if (approvedBrandsCount >= bazaar.maxBrandCapacity) {
    return next(appError.createError(
        "This bazaar has reached its maximum brand capacity",
        400,
        httpStatus.FAIL
    ));
}
    // 2. التحقق إن نفس الإيميل في نفس البازار مش موجود
    const existing = await WaitingList.findOne({ bazaarId, email });
    if (existing) {
        return next(appError.createError(
            "You already applied to this bazaar",
            400, httpStatus.FAIL
        ));
    }

    // 3. حفظ البيانات في WaitingList
    const waitingEntry = await WaitingList.create({
        bazaarId,
        email, firstName, lastName, phone, whatsapp,
        brandName, brandCategory, brandDescription, logoUrl, backgroundImage, location,
        brandType,
        socialMediaLinks,
        status: 'PENDING'
    });

    // 4. بعت إيميل تأكيد
    try {
        await sendEmail({
            email,
            subject: 'Application Received - Bazaary 🎉',
            message: `
                مرحباً ${firstName}!
                وصلنا طلبك للانضمام لـ ${bazaar.bazaarName}.
                هيتم مراجعة طلبك وهنبعتلك إيميل بالنتيجة قريباً.
            `
        });
    } catch (err) {
        console.error("Error sending confirmation email:", err);
    }

    res.status(201).json({
        status: httpStatus.SUCCESS,
        message: 'Application submitted successfully. Waiting for approval.',
        data: { waitingEntry }
    });
});

const getPackages = asyncWrapper(async (req, res) => {
  const packages = getAllPackages();
  res.status(200).json({
    status: httpStatus.SUCCESS,
    data: { packages },
  });
});

module.exports = {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  registerBazaar,
  registerBrand,
  getPackages
};