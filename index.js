require('dotenv').config();
const express = require("express");
const mongoose = require('mongoose');
const httpStatusText = require("./utils/httpStatusText");
const cors = require('cors');
const authRoutes=require('./routes/auth.route')
const brandRoutes = require('./routes/brand.route');
const bazaarRoute=require('./routes/bazaarRoute');

//create express app
const app = express();

//import cors middleware to allow cross-origin requests
app.use(cors());

//connect to mongodb server
const url = process.env.MONGO_URL;
mongoose.connect(url).then(() => {
    console.log("mongodb server started");
});

//middlewareto parse json data from request body
app.use(express.json());

app.use('/api/auth',authRoutes)
app.use('/api/brand', brandRoutes);
app.use('/api/bazaar',bazaarRoute)

//handle 404 error for undefined routes
app.use((req, res) => {
    res.status(404).json({status: httpStatusText.ERROR, message: "route not found"});
});

//global error handling middleware
app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({status: error.statusText || httpStatusText.ERROR, message: error.message, code: error.statusCode || 500, data: null});
});

// start the server
// app.listen(process.env.PORT, () => {
//     console.log(`listening on port ${process.env.PORT}`);
// })


module.exports = app; 