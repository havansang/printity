const router = require('express').Router();

const { validate } = require('../../middlewares/validate.middleware');
const shapeController = require('./shape.controller');
const { listShapesQuerySchema, shapeParamsSchema } = require('./shape.validation');

router.get('/', validate(listShapesQuerySchema, 'query'), shapeController.listShapes);
router.get('/:slug', validate(shapeParamsSchema, 'params'), shapeController.getShape);

module.exports = router;
