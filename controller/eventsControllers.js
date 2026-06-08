const asyncWrapper = require('../middleware/asyncWrapper');
const httpStatusText = require('../utils/httpStatusText');
const appError = require('../utils/appError');
const Bazaar = require('../models/bazaarModel');
const Brand = require('../models/brandModel');
const BazaarBrand = require('../models/bazaarBrandModel');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const syncBazaarStatus = require('../utils/syncBazaarStatus');

const getLiveBazaars = asyncWrapper(async (req, res, next) => {

    const now = new Date();


    await syncBazaarStatus(now);

    const liveBazaars = await Bazaar.find({
        status: "LIVE"
    });

    res.json({
        status: httpStatusText.SUCCESS,
        data: liveBazaars
    });
});

const getUpcomingBazaars = asyncWrapper(async (req, res, next) => {

    const now = new Date();

    await syncBazaarStatus(now);

    const upcomingBazaars = await Bazaar.find({
        status: "UPCOMING"
    });

    res.json({
        status: httpStatusText.SUCCESS,
        data: upcomingBazaars
    });
});

const getBazaarBrand = asyncWrapper(async (req, res, next) => {

    const { bazaarId } = req.params;
    const brands = await BazaarBrand.find({
        bazaarId
    }).populate("brandId");

    
    res.json({
        status: httpStatusText.SUCCESS,
        data: brands.map(item => item.brandId)
    });

});

const getBrandProducts = asyncWrapper(async (req, res, next) => {

    const { bazaarId, brandId } = req.params;

    const relation = await BazaarBrand.findOne({
        bazaarId,
        brandId
    });

    if (!relation) {
        const error = appError.createError("brand not in this bazaar", 404, httpStatusText.FAIL);
        return next(error);
    }

    const products = await Product.find({
        brandId
    });

    res.json({
        status: httpStatusText.SUCCESS,
        data: products
    });
});

const getProductDetails = asyncWrapper(async (req, res, next) => {
    const { bazaarId, brandId, productId } = req.params;

    const relation = await BazaarBrand.findOne({
        bazaarId,
        brandId
    });

    if (!relation) {
        const error = appError.createError("brand not in this bazaar", 404, httpStatusText.FAIL);
        return next(error);
    }

    const product = await Product.findOne({
        _id: productId,
        brandId: brandId
    });

    if (!product) {
        const error = appError.createError("product not found", 404, httpStatusText.FAIL);
        return next(error);
    }

    res.json({
        status: httpStatusText.SUCCESS,
        data: product
    });
});

module.exports = {
    getLiveBazaars,
    getUpcomingBazaars,
    getBazaarBrand,
    getBrandProducts,
    getProductDetails,
}