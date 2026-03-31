const ApiError = require('../../utils/ApiError');
const Shape = require('./shape.model');

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapShape(shape) {
  return {
    id: shape._id ? String(shape._id) : shape.id,
    name: shape.name,
    slug: shape.slug,
    group: shape.group,
    tags: Array.isArray(shape.tags) ? shape.tags : [],
    geometry: shape.geometry
      ? {
          pathCommands: shape.geometry.pathCommands,
          defaultWidth: shape.geometry.defaultWidth,
          defaultHeight: shape.geometry.defaultHeight,
        }
      : null,
    previewUrl: shape.previewUrl || null,
    source: shape.source || null,
    isActive: shape.isActive,
    sortOrder: shape.sortOrder ?? 0,
    createdAt: shape.createdAt,
    updatedAt: shape.updatedAt,
  };
}

async function listShapes({ search, activeOnly = true, group } = {}) {
  const filter = {};

  if (activeOnly) {
    filter.isActive = true;
  }

  if (group) {
    filter.group = group;
  }

  if (search) {
    const searchRegex = new RegExp(escapeRegExp(search.trim()), 'i');
    filter.$or = [
      { name: searchRegex },
      { slug: searchRegex },
      { tags: searchRegex },
    ];
  }

  const shapes = await Shape.find(filter)
    .sort({ sortOrder: 1, createdAt: 1, name: 1 })
    .lean();

  return shapes.map(mapShape);
}

async function getShapeBySlug(slug, { activeOnly = true } = {}) {
  const filter = {
    slug: String(slug || '').trim().toLowerCase(),
  };

  if (activeOnly) {
    filter.isActive = true;
  }

  const shape = await Shape.findOne(filter).lean();

  if (!shape) {
    throw new ApiError(404, 'Shape not found');
  }

  return mapShape(shape);
}

async function getShapeById(id, { activeOnly = true } = {}) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) {
    throw new ApiError(404, 'Shape not found');
  }

  const shape = await Shape.findById(normalizedId).lean();

  if (!shape || (activeOnly && shape.isActive === false)) {
    throw new ApiError(404, 'Shape not found');
  }

  return mapShape(shape);
}

module.exports = {
  getShapeById,
  getShapeBySlug,
  listShapes,
  mapShape,
};
