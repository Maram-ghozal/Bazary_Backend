const express = require('express');
const router = express.Router();
const { chat } = require('../controller/aiAssistantController');
const optionalAuth = require('../middleware/optionalAuth');

router.post('/:bazaarId/chat', optionalAuth, chat);

module.exports = router;