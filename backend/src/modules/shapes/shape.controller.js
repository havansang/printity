const { asyncHandler } = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const shapeService = require('./shape.service');

const listShapes = asyncHandler(async (req, res) => {
  const items = await shapeService.listShapes(req.query);

  sendSuccess(res, {
    message: 'Shapes fetched successfully',
    data: { items },
  });
});

const getShape = asyncHandler(async (req, res) => {
  const shape = await shapeService.getShapeBySlug(req.params.slug);

  sendSuccess(res, {
    message: 'Shape fetched successfully',
    data: { shape },
  });
});

module.exports = {
  getShape,
  listShapes,
};
