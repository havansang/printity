const ApiError = require('../../utils/ApiError');
const { SURFACE_KEYS } = require('../../constants/product');
const Template = require('./template.model');

function mapSurface(surface, key) {
  if (!surface) {
    return null;
  }

  return {
    key: surface.key || key,
    label: surface.label,
    position: surface.position || (key === 'neckLabelInner' ? 'neck' : key),
    domId: surface.domId || [],
    sequence: surface.sequence ?? 0,
    printable: surface.printable ?? true,
    allowedDecorationMethods: surface.allowedDecorationMethods || [],
    templateImageUrl: surface.templateImageUrl,
    overlayImageUrl: surface.overlayImageUrl || null,
    maskImageUrl: surface.maskImageUrl || null,
    printArea: surface.printArea,
    editor: surface.editor || null,
    transformPolicy: surface.transformPolicy || null,
    render: surface.render || null,
  };
}

function mapTemplate(template) {
  const surfaces = Object.fromEntries(
    SURFACE_KEYS.map((key) => [key, mapSurface(template.surfaces?.[key], key)]).filter(([, surface]) => Boolean(surface)),
  );

  return {
    id: template._id?.toString() || template.id,
    name: template.name,
    slug: template.slug,
    productType: template.productType,
    description: template.description || null,
    version: template.version ?? 1,
    providerRefs: template.providerRefs || null,
    supportedSurfaces: template.supportedSurfaces || Object.keys(surfaces),
    thumbnailUrl: template.thumbnailUrl || null,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
    surfaces,
    defaultRenderOptions: template.defaultRenderOptions || null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

async function listTemplates({ productType, activeOnly = true }) {
  const filter = {};

  if (productType) {
    filter.productType = productType;
  }

  if (activeOnly) {
    filter.isActive = true;
  }

  const templates = await Template.find(filter).sort({ sortOrder: 1, createdAt: 1 });
  return templates.map(mapTemplate);
}

async function getTemplateById(id) {
  const template = await Template.findById(id);

  if (!template) {
    throw new ApiError(404, 'Template not found');
  }

  return mapTemplate(template);
}

async function getActiveTemplateById(id) {
  const template = await Template.findOne({ _id: id, isActive: true });

  if (!template) {
    throw new ApiError(404, 'Template not found');
  }

  return template;
}

module.exports = {
  listTemplates,
  getTemplateById,
  getActiveTemplateById,
  mapTemplate,
};
