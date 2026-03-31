const router = require('express').Router();

const { validate } = require('../../middlewares/validate.middleware');
const mockupController = require('./mockup.controller');
const { mockupPreviewSchema } = require('./mockup.validation');

router.post('/preview', validate(mockupPreviewSchema), mockupController.previewMockup);

module.exports = router;
