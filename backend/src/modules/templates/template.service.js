const ApiError = require('../../utils/ApiError');
const Template = require('./template.model');

function mapTemplate(template) {
  return {
    id: template._id?.toString() || template.id,
    name: template.name,
    slug: template.slug,
    productType: template.productType,
    description: template.description || null,
    thumbnailUrl: template.thumbnailUrl || null,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
    surfaces: {
      front: {
        label: template.surfaces.front.label,
        templateImageUrl: template.surfaces.front.templateImageUrl,
        overlayImageUrl: template.surfaces.front.overlayImageUrl || null,
        maskImageUrl: template.surfaces.front.maskImageUrl || null,
        printArea: template.surfaces.front.printArea,
      },
      back: {
        label: template.surfaces.back.label,
        templateImageUrl: template.surfaces.back.templateImageUrl,
        overlayImageUrl: template.surfaces.back.overlayImageUrl || null,
        maskImageUrl: template.surfaces.back.maskImageUrl || null,
        printArea: template.surfaces.back.printArea,
      },
    },
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
