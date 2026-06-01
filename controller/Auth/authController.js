const appError = require("../../utils/appError");
const httpStatus = require("../../utils/httpStatusText");
const User = require("../../models/userModel");
const Customer = require("../../models/customerModel");
const generateToken = require("../../utils/generateWebToken");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require('crypto');
const asyncWrapper = require("../../middleware/asyncWrapper");
const sendEmail = require('../../utils/sendEmail');

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
    const forgotPassword = asyncWrapper(async (req, res, next) => {
    
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        return next(appError.createError("There is no user with this email address", 404, httpStatus.FAIL));
    }

  
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    
    
    await user.save({ validateBeforeSave: false });
    const resetURL = `http://localhost:5173/reset-password/${resetToken}`;
    
    const message = `Forgot your password? Click on the link below to reset it:\n\n${resetURL}\n\nIf you didn't forget your password, please ignore this email.`;

    try {
                await sendEmail({
            email: user.email,
            subject: 'Bazaary - Password Reset (Valid for 10 minutes)',
            message: message
        });

        res.status(200).json({
            status: httpStatus.SUCCESS,
            message: 'Token sent to email successfully!'
        });

    } catch (err) {
        console.log("Nodemailer Error Details: ", err);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(appError.createError('There was an error sending the email. Try again later!', 500, httpStatus.ERROR));
    }

});
const resetPassword = asyncWrapper(async (req, res, next) => {
    // 1. استخراج الرمز من الرابط وتشفيره عشان نقارنه باللي في الداتابيز
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    // 2. البحث عن المستخدم بالرمز المشفر، والتأكد إن الـ 10 دقايق مخلصوش
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() } // $gt معناها Greater Than (الوقت الحالي)
    });

    // 3. لو مفيش يوزر، أو الوقت خلص
    if (!user) {
        return next(appError.createError('Token is invalid or has expired', 400, httpStatus.FAIL));
    }

    // 4. تشفير الباسورد الجديد اللي العميل بعته
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(req.body.password, salt);

    // 5. مسح بيانات الطوارئ من الداتابيز (عشان الرمز ميستخدمش تاني)
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // 6. حفظ التعديلات
    await user.save({ validateBeforeSave: false });

    // 7. الرد بنجاح العملية
    res.status(200).json({
        status: httpStatus.SUCCESS,
        message: 'Password reset successfully. You can now log in with your new password!'
    });
});

module.exports={
    register,login,logout,forgotPassword,resetPassword
}