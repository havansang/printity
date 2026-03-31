const { asyncHandler } = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const fontService = require('./font.service');

const listFonts = asyncHandler(async (req, res) => {
  const result = await fontService.listBackendFonts(req.query);

  sendSuccess(res, {
    message: 'Fonts fetched successfully',
    data: result,
  });
});

const getFont = asyncHandler(async (req, res) => {
  const result = await fontService.getBackendFontByFamily({
    family: req.params.family,
    includeVariants: req.query.includeVariants,
  });

  sendSuccess(res, {
    message: 'Font fetched successfully',
    data: result,
  });
});

module.exports = {
  getFont,
  listFonts,
};
