const { asyncHandler } = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const mockupService = require('./mockup.service');

const previewMockup = asyncHandler(async (req, res) => {
  const result = await mockupService.renderMockupPreview(req.body);

  if (req.body.responseType === 'binary') {
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(result.buffer);
    return;
  }

  sendSuccess(res, {
    message: 'Mockup preview rendered successfully',
    data: result,
  });
});

module.exports = {
  previewMockup,
};
