require("dotenv").config();
const generateToken=require('./utils/generateWebToken');
const tokens = generateToken({
  id: "6a1dbec0f8cf15a70d66088a",
  role: "BRAND_OWNER",
});

console.log(tokens);