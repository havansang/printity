const router = require('express').Router();

const { requireAuth } = require('../../middlewares/auth.middleware');
const { singleImageUpload } = require('../../middlewares/upload.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const assetController = require('./asset.controller');
const { assetParamsSchema } = require('./asset.validation');

router.use(requireAuth);

router.get('/', assetController.listAssets);
router.post('/upload', singleImageUpload('file'), assetController.uploadAsset);
router.delete('/:id', validate(assetParamsSchema, 'params'), assetController.deleteAsset);

module.exports = router;
