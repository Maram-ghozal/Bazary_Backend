const multer = require("multer");
// Store uploaded files temporarily in memory(ram) as Buffer objects
const memoryStorage = multer.memoryStorage();

const upload = multer({ storage: memoryStorage});

module.exports = upload;