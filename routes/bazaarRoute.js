const express=require('express');
const router=express.Router();
const bazaarController=require('../controller/bazaarControllers');
const verifyToken=require('../middleware/verifyToken');
const requireRole=require('../middleware/roleMiddleware');


router.use(verifyToken,requireRole('BAZAAR_OWNER'));

router.get('/dashboard',bazaarController.getDashboard);

module.exports=router