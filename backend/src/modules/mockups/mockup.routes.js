const router = require('express').Router();

const { requireAuth } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const mockupController = require('./mockup.controller');
const { mockupPreviewSchema } = require('./mockup.validation');

router.use(requireAuth);

router.post('/preview', validate(mockupPreviewSchema), mockupController.previewMockup);

module.exports = router;
