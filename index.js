require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth.route");
const bazaarRoute = require("./routes/bazaarRoute");
const httpStatusText = require("./utils/httpStatusText");

const app = express();

app.use(express.json());
app.use(cors());

app.use('/api/auth', authRoutes);
app.use('/api/bazaar', bazaarRoute);

app.use((req, res) => {
  res.status(404).json({
    status: httpStatusText.ERROR,
    message: "route not found"
  });
});

app.use((error, req, res, next) => {
  res.status(error.statusCode || 500).json({
    status: error.statusText || httpStatusText.ERROR,
    message: error.message,
    code: error.statusCode || 500,
    data: null
  });
});

mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log("MongoDB connected");

    app.listen(process.env.PORT, () => {
      console.log(`Server running on ${process.env.PORT}`);
    });
  })
  .catch(err => console.log(err));

module.exports = app;