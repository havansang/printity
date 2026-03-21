const ApiError = require('../../utils/ApiError');
const { buildPagination } = require('../../utils/pagination');
const { getActiveTemplateById } = require('../templates/template.service');
const Project = require('./project.model');
const { mapProjectDetail, mapProjectSummary } = require('./project.mapper');

function hasOwnProperty(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function createDefaultSurfaces() {
  return {
    front: {
      canvasJson: null,
      previewImageUrl: null,
    },
    back: {
      canvasJson: null,
      previewImageUrl: null,
    },
  };
}

function normalizeProjectPayload(payload = {}) {
  const normalized = {};

  if (payload.surfaces?.front) {
    normalized.front = {};

    if (hasOwnProperty(payload.surfaces.front, 'canvasJson')) {
      normalized.front.canvasJson = payload.surfaces.front.canvasJson;
    }

    if (hasOwnProperty(payload.surfaces.front, 'previewImageUrl')) {
      normalized.front.previewImageUrl = payload.surfaces.front.previewImageUrl;
    }
  }

  if (payload.surfaces?.back) {
    normalized.back = {};

    if (hasOwnProperty(payload.surfaces.back, 'canvasJson')) {
      normalized.back.canvasJson = payload.surfaces.back.canvasJson;
    }

    if (hasOwnProperty(payload.surfaces.back, 'previewImageUrl')) {
      normalized.back.previewImageUrl = payload.surfaces.back.previewImageUrl;
    }
  }

  if (hasOwnProperty(payload, 'frontCanvasJson')) {
    normalized.front = normalized.front || {};
    normalized.front.canvasJson = payload.frontCanvasJson;
  }

  if (hasOwnProperty(payload, 'backCanvasJson')) {
    normalized.back = normalized.back || {};
    normalized.back.canvasJson = payload.backCanvasJson;
  }

  return normalized;
}

function buildInitialSurfaces(payload) {
  const surfaces = createDefaultSurfaces();
  const normalized = normalizeProjectPayload(payload);

  for (const key of Object.keys(normalized)) {
    if (hasOwnProperty(normalized[key], 'canvasJson')) {
      surfaces[key].canvasJson = normalized[key].canvasJson;
    }

    if (hasOwnProperty(normalized[key], 'previewImageUrl')) {
      surfaces[key].previewImageUrl = normalized[key].previewImageUrl;
    }
  }

  return surfaces;
}

function buildSurfaceUpdateOperations(payload) {
  const normalized = normalizeProjectPayload(payload);
  const update = {};

  for (const key of Object.keys(normalized)) {
    if (hasOwnProperty(normalized[key], 'canvasJson')) {
      update[`surfaces.${key}.canvasJson`] = normalized[key].canvasJson;
    }

    if (hasOwnProperty(normalized[key], 'previewImageUrl')) {
      update[`surfaces.${key}.previewImageUrl`] = normalized[key].previewImageUrl;
    }
  }

  return update;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listProjects(userId, query) {
  const filter = { userId };

  if (query.productType) {
    filter.productType = query.productType;
  }

  if (query.search) {
    filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
  }

  const page = query.page || 1;
  const limit = query.limit || 10;
  const skip = (page - 1) * limit;
  const sortDirection = query.sortOrder === 'asc' ? 1 : -1;

  const [items, total] = await Promise.all([
    Project.find(filter)
      .sort({ [query.sortBy]: sortDirection })
      .skip(skip)
      .limit(limit),
    Project.countDocuments(filter),
  ]);

  return {
    items: items.map(mapProjectSummary),
    pagination: buildPagination({ page, limit, total }),
  };
}

async function createProject(userId, payload) {
  const template = await getActiveTemplateById(payload.templateId);

  const project = await Project.create({
    userId,
    name: payload.name,
    templateId: template._id,
    productType: template.productType,
    surfaces: buildInitialSurfaces(payload),
    thumbnailUrl: hasOwnProperty(payload, 'thumbnailUrl') ? payload.thumbnailUrl : null,
    status: 'draft',
    lastOpenedAt: new Date(),
  });

  await project.populate('templateId');

  return mapProjectDetail(project);
}

async function getProjectById(userId, projectId) {
  const project = await Project.findOne({ _id: projectId, userId }).populate('templateId');

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  return mapProjectDetail(project);
}

async function updateProject(userId, projectId, payload) {
  const project = await Project.findOne({ _id: projectId, userId });

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  const update = {
    ...buildSurfaceUpdateOperations(payload),
  };

  if (hasOwnProperty(payload, 'name')) {
    update.name = payload.name;
  }

  if (hasOwnProperty(payload, 'status')) {
    update.status = payload.status;
  }

  if (hasOwnProperty(payload, 'thumbnailUrl')) {
    update.thumbnailUrl = payload.thumbnailUrl;
  }

  if (hasOwnProperty(payload, 'templateId')) {
    const template = await getActiveTemplateById(payload.templateId);
    update.templateId = template._id;
    update.productType = template.productType;
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, 'No valid fields provided for update');
  }

  const updatedProject = await Project.findOneAndUpdate(
    { _id: projectId, userId },
    { $set: update },
    {
      new: true,
      runValidators: true,
    },
  ).populate('templateId');

  return mapProjectDetail(updatedProject);
}

async function autosaveProject(userId, projectId, payload) {
  const project = await Project.findOne({ _id: projectId, userId }).select('_id');

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  const update = {
    ...buildSurfaceUpdateOperations(payload),
    lastOpenedAt: payload.lastOpenedAt || new Date(),
  };

  if (hasOwnProperty(payload, 'thumbnailUrl')) {
    update.thumbnailUrl = payload.thumbnailUrl;
  }

  const updatedProject = await Project.findOneAndUpdate(
    { _id: projectId, userId },
    { $set: update },
    {
      new: true,
      runValidators: true,
    },
  ).select('_id updatedAt');

  return {
    id: updatedProject._id.toString(),
    updatedAt: updatedProject.updatedAt,
  };
}

async function deleteProject(userId, projectId) {
  const deletedProject = await Project.findOneAndDelete({ _id: projectId, userId });

  if (!deletedProject) {
    throw new ApiError(404, 'Project not found');
  }
}

async function duplicateProject(userId, projectId) {
  const project = await Project.findOne({ _id: projectId, userId });

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  const duplicate = await Project.create({
    userId,
    name: `${project.name} Copy`,
    templateId: project.templateId,
    productType: project.productType,
    surfaces: JSON.parse(JSON.stringify(project.surfaces)),
    thumbnailUrl: project.thumbnailUrl,
    status: project.status,
    lastOpenedAt: new Date(),
  });

  await duplicate.populate('templateId');

  return mapProjectDetail(duplicate);
}

module.exports = {
  listProjects,
  createProject,
  getProjectById,
  updateProject,
  autosaveProject,
  deleteProject,
  duplicateProject,
};
