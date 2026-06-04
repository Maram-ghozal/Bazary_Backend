const appError = require("../../utils/appError");
const httpStatus = require("../../utils/httpStatusText");
const User = require("../../models/userModel");
const Customer = require("../../models/customerModel");
const Bazaar = require('../../models/bazaarModel');
const Payment = require('../../models/paymentModel');
const Brand = require("../../models/brandModel");
const BazaarBrand =require("../../models/bazaarBrandModel");
const generateToken = require("../../utils/generateWebToken");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require('crypto');
const asyncWrapper = require("../../middleware/asyncWrapper");
const sendEmail = require('../../utils/sendEmail');
// 1---------register customer
const register= asyncWrapper(async(req,res,next)=>{
    const{email,password,fullName}=req.body;
    const existingUser= await User.findOne({email})
    if (existingUser){
        const error = appError.createError("This user is already existing", 400, httpStatus.FAIL);
        return next(error);
    }
    const hashedPassword= await bcrypt.hash(password,12)
    const newUser=await User.create({
        email,
        passwordHash:hashedPassword,
        role:'CUSTOMER'
    })
    await Customer.create({
        userId: newUser._id,
        fullName: fullName
    })
    const tokens= generateToken({
        id:newUser._id,
        role:newUser.role
    })
    res.cookie("refreshToken",tokens.refreshToken,{
        httpOnly:true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", // بيسمح بتبادل الكوكيز في نفس النطاق بشكل آمن
        maxAge: 7 * 24 * 60 * 60 * 1000
    })
    res.status(201).json({status: httpStatus.SUCCESS,
        message: "user registered successfully",
        data: {
            user: {
                id: newUser._id,
                email: newUser.email,
                fullName: fullName,
                role: newUser.role
            },
            accessToken: tokens.accessToken 
        }})
})
const login=asyncWrapper(async(req,res,next)=>{
    const{email,password}=req.body;
    if(!email || !password){
        const error=appError.createError("Please provide email and password", 400, httpStatus.FAIL)
        return next(error)
    }
    const user=await User.findOne({email})
    if(!user || (!await bcrypt.compare(password,user.passwordHash))){
        const error = appError.createError("Incorrect email or password", 401, httpStatus.FAIL);
        return next(error);
    }
    const tokens= generateToken({
        id:user._id,
        role:user.role
    })
    res.cookie("refreshToken",tokens.refreshToken,{
        httpOnly:true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", // بيسمح بتبادل الكوكيز في نفس النطاق بشكل آمن
        maxAge: 7 * 24 * 60 * 60 * 1000
    })
    res.status(200).json({status: httpStatus.SUCCESS,
        message: "user loggedin successfully",
        data: {
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            },
            accessToken: tokens.accessToken 
        }})
})
const logout=asyncWrapper(async(req,res,next)=>{
    res.clearCookie(
        "refreshToken",{
            httpOnly:true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
        })
        res.status(200).json({
        status: httpStatus.SUCCESS,
        message: "Logged out successfully",
        data: null
    });
})
// forget password
const forgotPassword = asyncWrapper(async (req, res, next) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        return next(appError.createError("There is no user with this email address", 404, httpStatus.FAIL));
    }

    // ✅ توليد OTP رقمي 6 خانات
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ تخزينه مشفر في الداتابيز
    user.passwordResetToken = crypto.createHash('sha256').update(otp).digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const message = `Your password reset code is: ${otp}\n\nValid for 10 minutes only.\nIf you didn't request this, ignore this email.`;

    try {
        await sendEmail({
            email: user.email,
            subject: 'Bazaary - Password Reset OTP',
            message: message
        });

        res.status(200).json({
            status: httpStatus.SUCCESS,
            message: 'OTP sent to email successfully!'
        });

    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return next(appError.createError('Error sending email. Try again later!', 500, httpStatus.ERROR));
    }
});
//reset
const resetPassword = asyncWrapper(async (req, res, next) => {
    const { email, otp, password } = req.body; 

    //  تشفير الـ OTP للمقارنة
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const user = await User.findOne({
        email,
        passwordResetToken: hashedOtp,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        return next(appError.createError('OTP is invalid or has expired', 400, httpStatus.FAIL));
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    //هنمسحهم من db
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        status: httpStatus.SUCCESS,
        message: 'Password reset successfully!'
    });
});
//2----------------register bazaar
const registerBazaar = asyncWrapper(async (req, res, next) => {
    const { 
        email, fullName, phone, whatsapp, 
        bazaarName, type, bazaarDescription, logoUrl, address, googleMapsLink, startDate, endDate,
        priceOffline, priceOnline, priceHybrid, paymentMethod 
    } = req.body;

    // ✅ حساب السعر حسب النوع
    const priceMap = {
        OFFLINE: priceOffline,
        ONLINE:  priceOnline,
        HYBRID:  priceHybrid
    };
    const amount = priceMap[type];
    if (!amount) {
        return next(appError.createError(
            `Price for type ${type} is required`,
            400, httpStatus.FAIL
        ));
    }

    let user = await User.findOne({ email });
    let isNewUser = false;
    let tempPassword = ""; 

    if (user) {
        if (user.role === 'CUSTOMER') {
            user.role = 'BAZAAR_OWNER';
            await user.save();
        }
    } else {
        tempPassword = Math.random().toString(36).slice(-8); 
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        user = await User.create({
            email,
            passwordHash: hashedPassword,
            role: 'BAZAAR_OWNER'
        });
        isNewUser = true;
    }

    if (isNewUser) {
        try {
            await sendEmail({
                email: user.email,
                subject: 'Your Bazaary Account Details',
                message: `
                    Welcome to Bazaary! 🎉
                    Your account has been successfully created.
                    Email: ${email}
                    Password: ${tempPassword}
                    Please log in and change your password as soon as possible.
                `
            });
        } catch (error) {
            console.error("Error sending password email:", error);
        }
    }

    const newBazaar = await Bazaar.create({
        userId: user._id,
        fullName, phone, whatsapp,
        bazaarName, type, bazaarDescription, logoUrl,
        address, googleMapsLink, startDate, endDate,
        priceOffline, priceOnline, priceHybrid, paymentMethod,
        status: 'PENDING_PAYMENT',
        isPaid: false
    });

    // ✅ Payment مربوط بالبازار + السعر الصح
    const newPayment = await Payment.create({
        userId: user._id,
        bazaarId: newBazaar._id,
        amount,
        purpose: 'BAZAAR_SUBSCRIPTION',
        status: 'PENDING'
    });

    res.status(201).json({
        status: httpStatus.SUCCESS,
        message: 'Bazaar registered successfully. Pending payment.',
        data: {
            bazaar: newBazaar,
            paymentId: newPayment._id,
            amount,
            isNewUser
            // TODO: clientSecret هيتضاف هنا لما نضيف Stripe
        }
    });
});
//3------------- register bazaar
const registerBrand = asyncWrapper(async (req, res, next) => {
    const { bazaarId } = req.params;
    const {
        email, firstName, lastName, phone, whatsapp,
        brandName, brandCategory, brandDescription, logoUrl, location,
        brandType  // 'OFFLINE' | 'ONLINE' | 'HYBRID'
    } = req.body;

    // 1. التحقق من البازار
    const bazaar = await Bazaar.findById(bazaarId);
    if (!bazaar) {
        return next(appError.createError("Bazaar not found", 404, httpStatus.FAIL));
    }
    if (!bazaar.isAcceptingBrands) {
        return next(appError.createError("This bazaar is not accepting brands", 400, httpStatus.FAIL));
    }

    // 2. حساب السعر حسب نوع البراند
    const priceMap = {
        OFFLINE: null,
        ONLINE:  bazaar.priceOnline,
        HYBRID:  bazaar.priceHybrid
    };
    const amount = priceMap[brandType];
    if (brandType !== 'OFFLINE' && !amount) {
        return next(appError.createError(
            `Bazaar has no price set for ${brandType}`,
            400, httpStatus.FAIL
        ));
    }

    // 3. إيجاد أو إنشاء User
    let user = await User.findOne({ email });
    let isNewUser = false;
    let tempPassword = "";

    if (user) {
        if (user.role === 'CUSTOMER') {
            user.role = 'BRAND_OWNER';
            await user.save();
        }
    } else {
        tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        user = await User.create({
            email,
            passwordHash: hashedPassword,
            role: 'BRAND_OWNER'
        });
        isNewUser = true;
    }

    if (isNewUser) {
        try {
            await sendEmail({
                email: user.email,
                subject: 'Your Bazaary Account Details',
                message: `
                    Welcome to Bazaary! 🎉
                    Email: ${email}
                    Password: ${tempPassword}
                    Please log in and change your password.
                `
            });
        } catch (err) {
            console.error("Error sending email:", err);
        }
    }

    // 4. إنشاء Brand Profile لو مش موجود
    let brand = await Brand.findOne({ userId: user._id });
    if (!brand) {
        brand = await Brand.create({
            userId: user._id,
            firstName, lastName, phone, whatsapp,
            brandName, brandCategory, brandDescription, logoUrl, location
        });
    }

    // 5. التحقق إن البراند مش مسجل في البازار ده قبل كده
    const existingEntry = await BazaarBrand.findOne({ 
        bazaarId, 
        brandId: brand._id 
    });
    if (existingEntry) {
        return next(appError.createError(
            "This brand is already registered in this bazaar",
            400, httpStatus.FAIL
        ));
    }

    // 6. إنشاء BazaarBrand
    const bazaarBrand = await BazaarBrand.create({
        bazaarId,
        brandId: brand._id,
        brandType,
        status: 'PENDING'
    });

    // 7. OFFLINE → مفيش دفع
    if (brandType === 'OFFLINE') {
        return res.status(201).json({
            status: httpStatus.SUCCESS,
            message: 'Brand registered successfully. No payment required.',
            data: {
                brand,
                bazaarBrand,
                requiresPayment: false,
                isNewUser
            }
        });
    }

    // 8. ONLINE أو HYBRID → Payment
    const payment = await Payment.create({
        userId: user._id,
        bazaarId: bazaar._id,
        amount,
        purpose: 'BRAND_SUBSCRIPTION',
        status: 'PENDING'
    });

    // ربط Payment بالـ BazaarBrand
    bazaarBrand.paymentId = payment._id;
    await bazaarBrand.save();

    res.status(201).json({
        status: httpStatus.SUCCESS,
        message: 'Brand registered. Payment pending.',
        data: {
            brand,
            bazaarBrand,
            paymentId: payment._id,
            amount,
            requiresPayment: true,
            isNewUser
            // TODO: clientSecret هيتضاف هنا لما نضيف Stripe
        }
    });
});
module.exports={
    register,login,logout,forgotPassword,resetPassword,registerBazaar,registerBrand 
}