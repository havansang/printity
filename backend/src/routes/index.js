const router = require('express').Router();

const authRoutes = require('../modules/auth/auth.routes');
const assetRoutes = require('../modules/assets/asset.routes');
const colorRoutes = require('../modules/colors/color.routes');
const fontRoutes = require('../modules/fonts/font.routes');
const mockupRoutes = require('../modules/mockups/mockup.routes');
const projectRoutes = require('../modules/projects/project.routes');
const shapeRoutes = require('../modules/shapes/shape.routes');
const templateRoutes = require('../modules/templates/template.routes');

router.use('/auth', authRoutes);
router.use('/templates', templateRoutes);
router.use('/projects', projectRoutes);
router.use('/assets', assetRoutes);
router.use('/colors', colorRoutes);
router.use('/fonts', fontRoutes);
router.use('/shapes', shapeRoutes);
router.use('/mockups', mockupRoutes);

module.exports = router;
