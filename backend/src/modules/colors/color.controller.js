const { asyncHandler } = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const colorService = require('./color.service');

const listColors = asyncHandler(async (req, res) => {
  const result = await colorService.listColors();

  sendSuccess(res, {
    message: 'Colors fetched successfully',
    data: result,
  });
});

module.exports = {
  listColors,
};
