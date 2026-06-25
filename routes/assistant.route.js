const express = require('express');
const router = express.Router();
const { chat, chatGlobal } = require('../controller/aiAssistantController');
const optionalAuth = require('../middleware/optionalAuth');

router.post('/chat', optionalAuth, chatGlobal);

router.post('/:bazaarId/chat', optionalAuth, chat);

module.exports = router;