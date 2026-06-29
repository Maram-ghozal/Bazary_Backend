const express=require('express');
const router=express.Router();
const eventsController=require('../controller/eventsControllers');
const { getCart, addToCart, updateCartItem, removeFromCart, clearCart } = require('../controller/cartController');
const { checkout } = require('../controller/checkoutController');
const { getMyOrders } = require('../controller/orderController');
const { getWishlist, addToWishlist, removeFromWishlist, mergeWishlist } = require('../controller/WishlistController');
const checkBazaarLive=require('../middleware/checkBazaarLive');
const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth'); 
const validate = require("../middleware/validateMiddleware");
const {createBrandReviewSchema,updateBrandReviewSchema}=require("../utils/validation/brandReviewValidation");
const {createProductReviewSchema,updateProductReviewSchema}=require("../utils/validation/productReviewValidation");

router.get('/live',eventsController.getLiveBazaars);
router.get('/live/stats', eventsController.getLiveStats);
router.get('/live/brands', eventsController.getAllLiveBrands);
router.get('/live/products', eventsController.getAllLiveProducts);
router.get('/live/top-products', eventsController.getTopSellingProducts);
router.get('/upcoming',eventsController.getUpcomingBazaars);
router.get('/live/:bazaarId/brands',checkBazaarLive,eventsController.getBazaarBrand);
router.get('/live/:bazaarId/brands/:brandId/products',checkBazaarLive,eventsController.getBrandProducts);
router.get('/live/:bazaarId/brands/:brandId/products/:productId',checkBazaarLive,eventsController.getProductDetails);

//checkout
router.post('/checkout', verifyToken, checkout);

//cart
router.get('/cart', verifyToken, getCart);
router.post('/cart', verifyToken, addToCart);
router.patch('/cart/:productId', verifyToken, updateCartItem);
router.delete('/cart/:productId', verifyToken, removeFromCart);
router.delete('/cart', verifyToken, clearCart);

//customer orders
router.get('/my-orders', verifyToken, getMyOrders);

//wishlist
router.get('/wishlist', optionalAuth, getWishlist);
router.post('/wishlist/merge', verifyToken, mergeWishlist);  
router.post('/wishlist', optionalAuth, addToWishlist);
router.delete('/wishlist/:productId', optionalAuth, removeFromWishlist);

//product review
router.post("/products/:productId/review",verifyToken,validate(createProductReviewSchema),eventsController.addOrUpdateProductReview);
router.patch("/products/:productId/review",verifyToken,validate(updateProductReviewSchema),eventsController.addOrUpdateProductReview);
router.get("/products/:productId/reviews",eventsController.getProductReview);

//brand review
router.post("/brands/:brandId/review",verifyToken,validate(createBrandReviewSchema),eventsController.addOrUpdateBrandReview);
router.patch("/brands/:brandId/review",verifyToken,validate(updateBrandReviewSchema),eventsController.addOrUpdateBrandReview);
router.get("/brands/:brandId/reviews",eventsController.getBrandReview);

module.exports=router;