const appError = require("../../utils/appError");
const httpStatus = require("../../utils/httpStatusText");
const User = require("../../models/userModel");
const Customer = require("../../models/customerModel");
const generateToken = require("../../utils/generateWebToken");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const asyncWrapper = require("../../middleware/asyncWrapper");


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
module.exports={
    register
}