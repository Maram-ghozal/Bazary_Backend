const express=require('express');
const router=express.Router();
const bazaarController=require('../controller/bazaarControllers');
const verifyToken=require('../middleware/verifyToken');

router.use(verifyToken,)

router.get('/dashboard',bazaarController.getDashboard);

module.exports=router