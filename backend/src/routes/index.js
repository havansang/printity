const router = require('express').Router();

const authRoutes = require('../modules/auth/auth.routes');
const assetRoutes = require('../modules/assets/asset.routes');
const projectRoutes = require('../modules/projects/project.routes');
const templateRoutes = require('../modules/templates/template.routes');

router.use('/auth', authRoutes);
router.use('/templates', templateRoutes);
router.use('/projects', projectRoutes);
router.use('/assets', assetRoutes);

module.exports = router;
