const ApiError = require('../../utils/ApiError');
const { SURFACE_KEYS } = require('../../constants/product');
const { buildPagination } = require('../../utils/pagination');
const { getActiveTemplateById } = require('../templates/template.service');
const Project = require('./project.model');
const { mapProjectDetail, mapProjectSummary } = require('./project.mapper');

const SURFACE_MUTABLE_FIELDS = [
  'canvasJson',
  'previewImageUrl',
  'designCompositeUrl',
  'designCompositeWidth',
  'designCompositeHeight',
  'renderStatus',
  'renderHash',
];

const LEGACY_CANVAS_FIELD_BY_SURFACE = {
  front: 'frontCanvasJson',
  back: 'backCanvasJson',
  neckLabelInner: 'neckLabelInnerCanvasJson',
};

function hasOwnProperty(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function cloneValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function createDefaultSurfaces() {
  return Object.fromEntries(
    SURFACE_KEYS.map((key) => [
      key,
      {
        canvasJson: null,
        previewImageUrl: null,
        designCompositeUrl: null,
        designCompositeWidth: null,
        designCompositeHeight: null,
        renderStatus: 'idle',
        renderHash: null,
      },
    ]),
  );
}

function normalizeProjectPayload(payload = {}) {
  const normalized = {};

  for (const key of SURFACE_KEYS) {
    const surfacePayload = payload.surfaces?.[key];

    if (surfacePayload) {
      normalized[key] = normalized[key] || {};

      for (const field of SURFACE_MUTABLE_FIELDS) {
        if (hasOwnProperty(surfacePayload, field)) {
          normalized[key][field] = surfacePayload[field];
        }
      }
    }

    const legacyCanvasField = LEGACY_CANVAS_FIELD_BY_SURFACE[key];

    if (hasOwnProperty(payload, legacyCanvasField)) {
      normalized[key] = normalized[key] || {};
      normalized[key].canvasJson = payload[legacyCanvasField];
    }
  }

  return normalized;
}

function buildInitialSurfaces(payload) {
  const surfaces = createDefaultSurfaces();
  const normalized = normalizeProjectPayload(payload);

  for (const key of Object.keys(normalized)) {
    for (const field of SURFACE_MUTABLE_FIELDS) {
      if (hasOwnProperty(normalized[key], field)) {
        surfaces[key][field] = normalized[key][field];
      }
    }
  }

  return surfaces;
}

function buildSurfaceUpdateOperations(payload) {
  const normalized = normalizeProjectPayload(payload);
  const update = {};

  for (const key of Object.keys(normalized)) {
    for (const field of SURFACE_MUTABLE_FIELDS) {
      if (hasOwnProperty(normalized[key], field)) {
        update[`surfaces.${key}.${field}`] = normalized[key][field];
      }
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
    selection: hasOwnProperty(payload, 'selection') ? payload.selection : null,
    renderOptions: hasOwnProperty(payload, 'renderOptions') ? payload.renderOptions : null,
    printPayloadRaw: hasOwnProperty(payload, 'printPayloadRaw') ? payload.printPayloadRaw : null,
    printPayloadNormalized: hasOwnProperty(payload, 'printPayloadNormalized') ? payload.printPayloadNormalized : null,
    surfaces: buildInitialSurfaces(payload),
    thumbnailUrl: hasOwnProperty(payload, 'thumbnailUrl') ? payload.thumbnailUrl : null,
    status: 'draft',
    lastOpenedAt: new Date(),
    lastRenderedAt: hasOwnProperty(payload, 'lastRenderedAt') ? payload.lastRenderedAt : null,
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

  if (hasOwnProperty(payload, 'selection')) {
    update.selection = payload.selection;
  }

  if (hasOwnProperty(payload, 'renderOptions')) {
    update.renderOptions = payload.renderOptions;
  }

  if (hasOwnProperty(payload, 'printPayloadRaw')) {
    update.printPayloadRaw = payload.printPayloadRaw;
  }

  if (hasOwnProperty(payload, 'printPayloadNormalized')) {
    update.printPayloadNormalized = payload.printPayloadNormalized;
  }

  if (hasOwnProperty(payload, 'thumbnailUrl')) {
    update.thumbnailUrl = payload.thumbnailUrl;
  }

  if (hasOwnProperty(payload, 'lastOpenedAt')) {
    update.lastOpenedAt = payload.lastOpenedAt;
  }

  if (hasOwnProperty(payload, 'lastRenderedAt')) {
    update.lastRenderedAt = payload.lastRenderedAt;
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

  if (hasOwnProperty(payload, 'selection')) {
    update.selection = payload.selection;
  }

  if (hasOwnProperty(payload, 'renderOptions')) {
    update.renderOptions = payload.renderOptions;
  }

  if (hasOwnProperty(payload, 'printPayloadRaw')) {
    update.printPayloadRaw = payload.printPayloadRaw;
  }

  if (hasOwnProperty(payload, 'printPayloadNormalized')) {
    update.printPayloadNormalized = payload.printPayloadNormalized;
  }

  if (hasOwnProperty(payload, 'thumbnailUrl')) {
    update.thumbnailUrl = payload.thumbnailUrl;
  }

  if (hasOwnProperty(payload, 'lastRenderedAt')) {
    update.lastRenderedAt = payload.lastRenderedAt;
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
    selection: cloneValue(project.selection),
    renderOptions: cloneValue(project.renderOptions),
    printPayloadRaw: cloneValue(project.printPayloadRaw),
    printPayloadNormalized: cloneValue(project.printPayloadNormalized),
    surfaces: cloneValue(project.surfaces),
    thumbnailUrl: project.thumbnailUrl,
    status: project.status,
    lastOpenedAt: new Date(),
    lastRenderedAt: project.lastRenderedAt,
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
