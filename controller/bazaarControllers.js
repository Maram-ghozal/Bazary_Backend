const asyncWrapper=require('../middleware/asyncWrapper');
const httpStatusText=require('../utils/httpStatusText');
const appError=require('../utils/appError');
const bazaar=require('../models/bazaarModel');
const brand=require('../models/brandModel');
const bazaarBrand=require('../models/bazaarBrandModel');
const order=require('../models/orderModel');
const product=require('../models/productModel');

const getDashboard=asyncWrapper(async(req,res,next)=>{

});

module.exports={
    getDashboard
}