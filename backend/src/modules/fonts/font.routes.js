const router = require('express').Router();

const { validate } = require('../../middlewares/validate.middleware');
const fontController = require('./font.controller');
const { fontParamsSchema, listFontsQuerySchema } = require('./font.validation');

router.get('/', validate(listFontsQuerySchema, 'query'), fontController.listFonts);
router.get('/:family', validate(fontParamsSchema, 'params'), validate(listFontsQuerySchema, 'query'), fontController.getFont);

module.exports = router;
