const router = require('express').Router();

const colorController = require('./color.controller');

router.get('/', colorController.listColors);

module.exports = router;
