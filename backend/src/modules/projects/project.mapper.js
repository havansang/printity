const { SURFACE_KEYS } = require('../../constants/product');
const { mapTemplate } = require('../templates/template.service');

function getId(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value._id) {
    return value._id.toString();
  }

  if (value.id) {
    return value.id.toString();
  }

  return value.toString();
}

function mapProjectSurface(surface) {
  return {
    canvasJson: surface?.canvasJson ?? null,
    previewImageUrl: surface?.previewImageUrl ?? null,
    designCompositeUrl: surface?.designCompositeUrl ?? null,
    designCompositeWidth: surface?.designCompositeWidth ?? null,
    designCompositeHeight: surface?.designCompositeHeight ?? null,
    renderStatus: surface?.renderStatus ?? 'idle',
    renderHash: surface?.renderHash ?? null,
  };
}

function mapProjectSummary(project) {
  return {
    id: getId(project),
    name: project.name,
    templateId: getId(project.templateId),
    productType: project.productType,
    thumbnailUrl: project.thumbnailUrl ?? null,
    status: project.status,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
  };
}

function mapProjectDetail(project) {
  const surfaces = Object.fromEntries(SURFACE_KEYS.map((key) => [key, mapProjectSurface(project.surfaces?.[key])]));

  const template =
    project.templateId &&
    typeof project.templateId === 'object' &&
    project.templateId.productType &&
    project.templateId.surfaces
      ? mapTemplate(project.templateId)
      : null;

  return {
    id: getId(project),
    name: project.name,
    templateId: getId(project.templateId),
    template,
    productType: project.productType,
    selection: project.selection ?? null,
    renderOptions: project.renderOptions ?? null,
    printPayloadRaw: project.printPayloadRaw ?? null,
    printPayloadNormalized: project.printPayloadNormalized ?? null,
    surfaces,
    frontCanvasJson: surfaces.front.canvasJson,
    backCanvasJson: surfaces.back.canvasJson,
    neckLabelInnerCanvasJson: surfaces.neckLabelInner.canvasJson,
    thumbnailUrl: project.thumbnailUrl ?? null,
    status: project.status,
    lastOpenedAt: project.lastOpenedAt ?? null,
    lastRenderedAt: project.lastRenderedAt ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

module.exports = {
  mapProjectSummary,
  mapProjectDetail,
};
