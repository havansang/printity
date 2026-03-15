const router = require('express').Router();

const { validate } = require('../../middlewares/validate.middleware');
const templateController = require('./template.controller');
const { listTemplatesQuerySchema, templateParamsSchema } = require('./template.validation');

router.get('/', validate(listTemplatesQuerySchema, 'query'), templateController.listTemplates);
router.get('/:id', validate(templateParamsSchema, 'params'), templateController.getTemplate);

module.exports = router;
