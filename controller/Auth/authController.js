const appError = require("../../utils/appError");
const httpStatus = require("../../utils/httpStatusText");
const User = require("../../models/userModel");
const Customer = require("../../models/customerModel");
const Bazaar = require('../../models/bazaarModel');
const Payment = require('../../models/paymentModel');

const generateToken = require("../../utils/generateWebToken");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require('crypto');
const asyncWrapper = require("../../middleware/asyncWrapper");
const sendEmail = require('../../utils/sendEmail');
// register customer
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

const registerBazaar = asyncWrapper(async (req, res, next) => {
    const { 
        email, fullName, phone, whatsapp, 
        bazaarName, type, bazaarDescription, logoUrl, address, googleMapsLink, startDate, endDate,
        priceOffline, priceOnline, priceHybrid, paymentMethod 
    } = req.body;

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
        const message = `
            Welcome to Bazaary! 🎉
            Your account has been successfully created.
            Here are your temporary login details:
            Email: ${email}
            Password: ${tempPassword}
            Please log in and change your password as soon as possible.
        `;
        try {
            await sendEmail({
                email: user.email,
                subject: 'Your Bazaary Account Details',
                message: message
            });
        } catch (error) {
            console.error("Error sending password email:", error);
        }
    }

    const newBazaar = await Bazaar.create({
        userId: user._id,
        fullName, phone, whatsapp,
        bazaarName, type, bazaarDescription, logoUrl, address, googleMapsLink, startDate, endDate,
        priceOffline, priceOnline, priceHybrid, paymentMethod
    });

    const newPayment = await Payment.create({
        userId: user._id,
        amount: 500, 
        purpose: 'BAZAAR_SUBSCRIPTION',
        status: 'PENDING'
    });

    res.status(201).json({
        status: 'SUCCESS',
        message: 'Bazaar registered successfully. Pending payment.',
        data: {
            bazaar: newBazaar,
            paymentId: newPayment._id,
            isNewUser 
        }
    });
});
module.exports={
    register,login,logout,forgotPassword,resetPassword,registerBazaar
}