const { asyncHandler } = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const assetService = require('./asset.service');

const uploadAsset = asyncHandler(async (req, res) => {
  const asset = await assetService.uploadAsset(req.user.userId, req.file);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Asset uploaded successfully',
    data: asset,
  });
});

const listAssets = asyncHandler(async (req, res) => {
  const items = await assetService.listAssets(req.user.userId);
  sendSuccess(res, {
    message: 'Assets fetched successfully',
    data: { items },
  });
});

const deleteAsset = asyncHandler(async (req, res) => {
  await assetService.deleteAsset(req.user.userId, req.params.id);
  sendSuccess(res, {
    message: 'Asset deleted successfully',
    data: {},
  });
});

module.exports = {
  uploadAsset,
  listAssets,
  deleteAsset,
};
