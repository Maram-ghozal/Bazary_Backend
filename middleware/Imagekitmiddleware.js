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
  // Case A: upload.fields([{name: "logoUrl"}, {name: "backgroundImage"}, ...])
  // req.files here is an object like { logoUrl: [file], backgroundImage: [file] }
  if (req.files && !Array.isArray(req.files) && typeof req.files === "object") {
    const fieldNames = Object.keys(req.files);

    if (fieldNames.length === 0) {
      return next();
    }

    req.uploadedFiles = {};
    const allUrls = [];

    for (const fieldName of fieldNames) {
      const filesForField = req.files[fieldName];

      const uploadPromises = filesForField.map((file) =>
        imagekit.upload({
          file: file.buffer,
          fileName: file.originalname,
          folder: "bazaary-app",
        })
      );

      const results = await Promise.all(uploadPromises);
      const urls = results.map((result) => result.url);

      // Each of these fields is configured with maxCount: 1, so keep a single URL per field
      req.uploadedFiles[fieldName] = urls[0];
      allUrls.push(...urls);
    }

    // Kept for backward compatibility with older code that reads req.imagesUrls
    req.imagesUrls = allUrls;

    return next();
  }

  // Case B: upload.single() or upload.array() (original behaviour, unchanged)
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
