const express=require('express');
const router=express.Router();
const eventsController=require('../controller/eventsControllers');
const checkBazaarLive=require('../middleware/checkBazaarLive');
const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth'); 

router.get('/live',eventsController.getLiveBazaars);
router.get('/upcoming',eventsController.getUpcomingBazaars);
router.get('/live/:bazaarId/brands',checkBazaarLive,eventsController.getBazaarBrand);
router.get('/live/:bazaarId/brands/:brandId/products',checkBazaarLive,eventsController.getBrandProducts);
router.get('/live/:bazaarId/brands/:brandId/products/:productId',checkBazaarLive,eventsController.getProductDetails);
router.post('/live/:bazaarId/brands/:brandId/orders', checkBazaarLive, optionalAuth, eventsController.createOrder);

module.exports=router;