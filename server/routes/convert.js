const express = require('express');
const router = express.Router();
const convertController = require('../controllers/convertController');

router.post('/convert', convertController.convertVideo);

module.exports = router; 