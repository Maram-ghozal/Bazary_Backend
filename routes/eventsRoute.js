const express=require('express');
const router=express.Router();
const eventsController=require('../controller/eventsControllers');
const checkBazaarLive=require('../middleware/checkBazaarLive');

router.get('/live',eventsController.getLiveBazaars);
router.get('/upcoming',eventsController.getUpcomingBazaars);
router.get('/live/:bazaarId/brands',checkBazaarLive,eventsController.getBazaarBrand);
router.get('/live/:bazaarId/brands/:brandId/products',checkBazaarLive,eventsController.getBrandProducts);
router.get('/live/:bazaarId/brands/:brandId/products/:productId',checkBazaarLive,eventsController.getProductDetails);

module.exports=router;