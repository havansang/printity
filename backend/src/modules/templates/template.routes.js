const router = require('express').Router();

const { validate } = require('../../middlewares/validate.middleware');
const templateController = require('./template.controller');
const { listTemplatesQuerySchema, templateParamsSchema, templateUpdateBodySchema } = require('./template.validation');

router.get('/', validate(listTemplatesQuerySchema, 'query'), templateController.listTemplates);
router.get('/:id', validate(templateParamsSchema, 'params'), templateController.getTemplate);
router.get('/:id/render-audit', validate(templateParamsSchema, 'params'), templateController.getTemplateRenderAudit);
router.patch('/:id', validate(templateParamsSchema, 'params'), validate(templateUpdateBodySchema, 'body'), templateController.updateTemplate);

module.exports = router;
