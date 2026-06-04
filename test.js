require("dotenv").config();
const generateToken=require('./utils/generateWebToken');
const tokens = generateToken({
  id: "6a1f16a9da1c996d8a138cbd",
  role: "BAZAAR_OWNER",
});

console.log(tokens);