const { asyncHandler } = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const projectService = require('./project.service');

const listProjects = asyncHandler(async (req, res) => {
  const result = await projectService.listProjects(req.user.userId, req.query);
  sendSuccess(res, {
    message: 'Projects fetched successfully',
    data: result,
  });
});

const createProject = asyncHandler(async (req, res) => {
  const project = await projectService.createProject(req.user.userId, req.body);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Project created successfully',
    data: { project },
  });
});

const getProject = asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById(req.user.userId, req.params.id);
  sendSuccess(res, {
    message: 'Project fetched successfully',
    data: { project },
  });
});

const updateProject = asyncHandler(async (req, res) => {
  const project = await projectService.updateProject(req.user.userId, req.params.id, req.body);
  sendSuccess(res, {
    message: 'Project updated successfully',
    data: { project },
  });
});

const autosaveProject = asyncHandler(async (req, res) => {
  const result = await projectService.autosaveProject(req.user.userId, req.params.id, req.body);
  sendSuccess(res, {
    message: 'Project autosaved',
    data: result,
  });
});

const deleteProject = asyncHandler(async (req, res) => {
  await projectService.deleteProject(req.user.userId, req.params.id);
  sendSuccess(res, {
    message: 'Project deleted successfully',
    data: {},
  });
});

const duplicateProject = asyncHandler(async (req, res) => {
  const project = await projectService.duplicateProject(req.user.userId, req.params.id);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Project duplicated successfully',
    data: { project },
  });
});

module.exports = {
  listProjects,
  createProject,
  getProject,
  updateProject,
  autosaveProject,
  deleteProject,
  duplicateProject,
};
