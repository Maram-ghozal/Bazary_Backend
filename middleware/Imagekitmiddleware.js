const asyncWrapper = require("./asyncWrapper");
const ImageKit = require("imagekit");
const AppError = require("../utils/appError");
const httpStatusText = require("../utils/httpStatusText");

//to connect to imagekit server
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// to upload images to imagekit server and get their urls
const uploadOnImageKit = asyncWrapper(async (req, res, next) => {
  const files =
    req.files && req.files.length > 0 ? req.files : req.file ? [req.file] : [];

  if (files.length === 0) {
    return next();
  }
  const uploadPromises = files.map((file) => {
    return imagekit.upload({
      file: file.buffer, //
      fileName: file.originalname, // imageName
      folder: "bazaary-app", //folderName store in imageKit
    });
  });

  const results = await Promise.all(uploadPromises);

  req.imagesUrls = results.map((result) => result.url);

  next();
});

module.exports = uploadOnImageKit;
