const router = require('express').Router();

const { requireAuth } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const projectController = require('./project.controller');
const {
  autosaveProjectSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  projectParamsSchema,
  updateProjectSchema,
} = require('./project.validation');

router.use(requireAuth);

router.get('/', validate(listProjectsQuerySchema, 'query'), projectController.listProjects);
router.post('/', validate(createProjectSchema), projectController.createProject);
router.get('/:id', validate(projectParamsSchema, 'params'), projectController.getProject);
router.put('/:id', validate(projectParamsSchema, 'params'), validate(updateProjectSchema), projectController.updateProject);
router.patch(
  '/:id/autosave',
  validate(projectParamsSchema, 'params'),
  validate(autosaveProjectSchema),
  projectController.autosaveProject,
);
router.delete('/:id', validate(projectParamsSchema, 'params'), projectController.deleteProject);
router.post('/:id/duplicate', validate(projectParamsSchema, 'params'), projectController.duplicateProject);

module.exports = router;
