const fs = require('fs/promises');
const path = require('path');

const ApiError = require('../../utils/ApiError');
const { SURFACE_KEYS } = require('../../constants/product');
const Template = require('./template.model');
const { templateSeedSchema } = require('./template.validation');

const MOCKUP_ROOT = path.resolve(process.cwd(), 'resources', 'mockups');
const UPLOAD_ROOT = path.resolve(process.cwd(), '..', 'uploads');

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
  const previewScenes = Array.isArray(template.previewScenes)
    ? template.previewScenes
      .filter((scene) => scene?.isActive !== false)
      .sort((left, right) => (
        (left?.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right?.sortOrder ?? Number.MAX_SAFE_INTEGER)
      ))
      .map((scene) => ({
        key: scene.key,
        label: scene.label,
        sortOrder: scene.sortOrder ?? 0,
        surfaceKeys: Array.isArray(scene.surfaceKeys) ? scene.surfaceKeys : [],
        isDefault: scene.isDefault === true,
        isActive: scene.isActive !== false,
        render: scene.render || null,
      }))
    : [];

  return {
    id: template._id?.toString() || template.id,
    name: template.name,
    slug: template.slug,
    productType: template.productType,
    description: template.description || null,
    version: template.version ?? 1,
    mockupPack: template.mockupPack || null,
    providerRefs: template.providerRefs || null,
    supportedSurfaces: template.supportedSurfaces || Object.keys(surfaces),
    previewScenes,
    availableColors: template.availableColors || [],
    thumbnailUrl: template.thumbnailUrl || null,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
    surfaces,
    defaultRenderOptions: template.defaultRenderOptions || null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(baseValue, patchValue) {
  if (patchValue === undefined) {
    return baseValue;
  }

  if (Array.isArray(patchValue)) {
    return patchValue;
  }

  if (!isPlainObject(baseValue) || !isPlainObject(patchValue)) {
    return patchValue;
  }

  const merged = { ...baseValue };

  for (const [key, value] of Object.entries(patchValue)) {
    merged[key] = deepMerge(baseValue?.[key], value);
  }

  return merged;
}

function mergePreviewScenes(existingScenes = [], patchScenes = []) {
  const mergedScenes = [...existingScenes];

  patchScenes.forEach((patchScene) => {
    const patchKey = String(patchScene?.key || '').trim();
    if (!patchKey) {
      return;
    }

    const matchedIndex = mergedScenes.findIndex((scene) => String(scene?.key || '').trim() === patchKey);

    if (matchedIndex === -1) {
      mergedScenes.push(patchScene);
      return;
    }

    mergedScenes[matchedIndex] = deepMerge(mergedScenes[matchedIndex], patchScene);
  });

  return mergedScenes;
}

function mergeTemplatePayload(existingTemplate, payload) {
  const nextTemplate = {
    ...existingTemplate,
    ...payload,
  };

  if (isPlainObject(payload?.mockupPack)) {
    nextTemplate.mockupPack = deepMerge(existingTemplate?.mockupPack || {}, payload.mockupPack);
  }

  if (isPlainObject(payload?.providerRefs)) {
    nextTemplate.providerRefs = deepMerge(existingTemplate?.providerRefs || {}, payload.providerRefs);
  }

  if (isPlainObject(payload?.defaultRenderOptions)) {
    nextTemplate.defaultRenderOptions = deepMerge(existingTemplate?.defaultRenderOptions || {}, payload.defaultRenderOptions);
  }

  if (isPlainObject(payload?.surfaces)) {
    nextTemplate.surfaces = {
      ...(existingTemplate?.surfaces || {}),
    };

    for (const [surfaceKey, surfacePatch] of Object.entries(payload.surfaces)) {
      if (!surfacePatch) {
        continue;
      }

      nextTemplate.surfaces[surfaceKey] = deepMerge(existingTemplate?.surfaces?.[surfaceKey] || {}, surfacePatch);
    }
  }

  if (Array.isArray(payload?.previewScenes)) {
    nextTemplate.previewScenes = mergePreviewScenes(existingTemplate?.previewScenes || [], payload.previewScenes);
  }

  return nextTemplate;
}

function getLocalAbsolutePathFromPublicUrl(assetUrl) {
  const normalizedInput = String(assetUrl || '').trim();
  if (!normalizedInput) {
    return null;
  }

  if (normalizedInput.startsWith('/mockups/')) {
    return path.resolve(MOCKUP_ROOT, normalizedInput.replace(/^\/mockups\//, ''));
  }

  if (normalizedInput.startsWith('/uploads/')) {
    return path.resolve(UPLOAD_ROOT, normalizedInput.replace(/^\/uploads\//, ''));
  }

  return null;
}

async function doesLocalAssetExist(assetUrl) {
  const localAbsolutePath = getLocalAbsolutePathFromPublicUrl(assetUrl);
  if (!localAbsolutePath) {
    return null;
  }

  try {
    await fs.access(localAbsolutePath);
    return true;
  } catch {
    return false;
  }
}

async function collectAssetIssues(target, assetMap, issues) {
  for (const [assetKey, assetUrl] of Object.entries(assetMap || {})) {
    if (!assetUrl) {
      continue;
    }

    const exists = await doesLocalAssetExist(assetUrl);
    if (exists === false) {
      issues.push({
        level: 'warning',
        code: 'missing_asset_file',
        target,
        field: assetKey,
        assetUrl,
        message: `Asset file not found for ${target}.${assetKey}`,
      });
    }
  }
}

function getSceneLayerPlacementStatus(surface, layer) {
  if (layer?.printArea || layer?.printQuad) {
    return 'configured';
  }

  if (layer?.inheritSurfaceRender === false) {
    return 'missing';
  }

  if (surface?.render?.printArea || surface?.render?.printQuad) {
    return 'inherited';
  }

  return 'missing';
}

async function getTemplateRenderAuditById(id) {
  const template = await Template.findById(id);

  if (!template) {
    throw new ApiError(404, 'Template not found');
  }

  const issues = [];
  const scenes = Array.isArray(template.previewScenes) ? template.previewScenes : [];
  const supportedSurfaces = Array.isArray(template.supportedSurfaces) ? template.supportedSurfaces : [];

  for (const surfaceKey of supportedSurfaces) {
    const surface = template.surfaces?.[surfaceKey];
    if (!surface) {
      issues.push({
        level: 'error',
        code: 'missing_surface',
        target: `surfaces.${surfaceKey}`,
        message: `Supported surface "${surfaceKey}" is missing from template.surfaces`,
      });
      continue;
    }

    const editorSvgExists = await doesLocalAssetExist(surface?.editor?.svgUrl);
    if (editorSvgExists === false) {
      issues.push({
        level: 'warning',
        code: 'missing_asset_file',
        target: `surfaces.${surfaceKey}.editor`,
        field: 'svgUrl',
        assetUrl: surface.editor.svgUrl,
        message: `Editor SVG not found for surface "${surfaceKey}"`,
      });
    }

    const surfaceBaseExists = await doesLocalAssetExist(surface?.render?.baseImageUrl);
    if (surface?.render?.baseImageUrl && surfaceBaseExists === false) {
      issues.push({
        level: 'warning',
        code: 'missing_asset_file',
        target: `surfaces.${surfaceKey}.render`,
        field: 'baseImageUrl',
        assetUrl: surface.render.baseImageUrl,
        message: `Surface base image not found for "${surfaceKey}"`,
      });
    }

    await collectAssetIssues(`surfaces.${surfaceKey}.render.assets`, surface?.render?.assets || {}, issues);
  }

  for (const scene of scenes) {
    const sceneKey = String(scene?.key || '').trim();
    const sceneRender = scene?.render || null;

    if (!sceneRender) {
      issues.push({
        level: 'warning',
        code: 'missing_scene_render',
        target: `previewScenes.${sceneKey}`,
        message: `Scene "${sceneKey}" has no render configuration`,
      });
      continue;
    }

    if (!sceneRender.basePattern && !sceneRender.baseImageUrl && !sceneRender.baseSurfaceKey) {
      issues.push({
        level: 'warning',
        code: 'missing_scene_base',
        target: `previewScenes.${sceneKey}.render`,
        message: `Scene "${sceneKey}" is missing basePattern/baseImageUrl/baseSurfaceKey`,
      });
    }

    if (!sceneRender.outputWidth || !sceneRender.outputHeight) {
      issues.push({
        level: 'info',
        code: 'missing_scene_output_size',
        target: `previewScenes.${sceneKey}.render`,
        message: `Scene "${sceneKey}" does not declare outputWidth/outputHeight explicitly`,
      });
    }

    if (sceneRender.baseImageUrl) {
      const sceneBaseExists = await doesLocalAssetExist(sceneRender.baseImageUrl);
      if (sceneBaseExists === false) {
        issues.push({
          level: 'warning',
          code: 'missing_asset_file',
          target: `previewScenes.${sceneKey}.render`,
          field: 'baseImageUrl',
          assetUrl: sceneRender.baseImageUrl,
          message: `Scene base image not found for "${sceneKey}"`,
        });
      }
    }

    const renderLayers = Array.isArray(sceneRender.layers) ? sceneRender.layers : [];
    const expectedSurfaceKeys = Array.isArray(scene.surfaceKeys) ? scene.surfaceKeys : [];

    for (const expectedSurfaceKey of expectedSurfaceKeys) {
      const hasSceneLayer = renderLayers.some((layer) => layer?.type === 'surface' && layer?.surfaceKey === expectedSurfaceKey);
      if (!hasSceneLayer) {
        issues.push({
          level: 'warning',
          code: 'missing_scene_surface_layer',
          target: `previewScenes.${sceneKey}.render.layers`,
          message: `Scene "${sceneKey}" is missing a surface layer for "${expectedSurfaceKey}"`,
        });
      }
    }

    for (let index = 0; index < renderLayers.length; index += 1) {
      const layer = renderLayers[index];
      const layerTarget = `previewScenes.${sceneKey}.render.layers[${index}]`;

      if (layer?.type === 'surface') {
        const surfaceKey = String(layer?.surfaceKey || '').trim();
        const surface = template.surfaces?.[surfaceKey];

        if (!surfaceKey || !surface) {
          issues.push({
            level: 'error',
            code: 'invalid_scene_surface_layer',
            target: layerTarget,
            message: `Scene "${sceneKey}" has a surface layer with invalid surfaceKey`,
          });
          continue;
        }

        const placementStatus = getSceneLayerPlacementStatus(surface, layer);
        if (placementStatus === 'missing') {
          issues.push({
            level: 'warning',
            code: 'missing_scene_surface_placement',
            target: layerTarget,
            message: `Scene "${sceneKey}" surface "${surfaceKey}" is missing scene-specific placement and cannot inherit one`,
          });
        }

        await collectAssetIssues(`${layerTarget}.assets`, layer?.assets || {}, issues);

        if (layer?.inheritSurfaceRender === false && !layer?.assets && !layer?.blendModes && !layer?.displacement) {
          issues.push({
            level: 'info',
            code: 'scene_layer_no_inherited_effects',
            target: layerTarget,
            message: `Scene "${sceneKey}" surface "${surfaceKey}" disables inherited render config; fill scene-specific assets/blend/displacement if needed`,
          });
        }
      }

      if (layer?.type === 'overlay' && layer?.assetUrl) {
        const overlayExists = await doesLocalAssetExist(layer.assetUrl);
        if (overlayExists === false) {
          issues.push({
            level: 'warning',
            code: 'missing_asset_file',
            target: layerTarget,
            field: 'assetUrl',
            assetUrl: layer.assetUrl,
            message: `Overlay asset not found for scene "${sceneKey}"`,
          });
        }
      }
    }

    const overlays = Array.isArray(sceneRender.overlays) ? sceneRender.overlays : [];
    for (let index = 0; index < overlays.length; index += 1) {
      const overlay = overlays[index];
      if (!overlay?.assetUrl) {
        issues.push({
          level: 'info',
          code: 'empty_scene_overlay',
          target: `previewScenes.${sceneKey}.render.overlays[${index}]`,
          message: `Scene "${sceneKey}" has an overlay entry without assetUrl`,
        });
        continue;
      }

      const overlayExists = await doesLocalAssetExist(overlay.assetUrl);
      if (overlayExists === false) {
        issues.push({
          level: 'warning',
          code: 'missing_asset_file',
          target: `previewScenes.${sceneKey}.render.overlays[${index}]`,
          field: 'assetUrl',
          assetUrl: overlay.assetUrl,
          message: `Overlay asset not found for scene "${sceneKey}"`,
        });
      }
    }
  }

  return {
    template: {
      id: template._id.toString(),
      slug: template.slug,
      productType: template.productType,
    },
    summary: {
      surfaceCount: supportedSurfaces.length,
      sceneCount: scenes.length,
      errorCount: issues.filter((issue) => issue.level === 'error').length,
      warningCount: issues.filter((issue) => issue.level === 'warning').length,
      infoCount: issues.filter((issue) => issue.level === 'info').length,
    },
    issues,
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

async function updateTemplateById(id, payload) {
  const template = await Template.findById(id);

  if (!template) {
    throw new ApiError(404, 'Template not found');
  }

  const currentTemplate = template.toObject({
    depopulate: true,
    versionKey: false,
  });
  delete currentTemplate._id;
  delete currentTemplate.createdAt;
  delete currentTemplate.updatedAt;

  const mergedTemplate = mergeTemplatePayload(currentTemplate, payload);
  const parsedTemplate = templateSeedSchema.parse(mergedTemplate);

  const updatedTemplate = await Template.findByIdAndUpdate(
    id,
    { $set: parsedTemplate },
    {
      new: true,
      runValidators: true,
    },
  );

  return mapTemplate(updatedTemplate);
}

module.exports = {
  listTemplates,
  getTemplateById,
  getActiveTemplateById,
  getTemplateRenderAuditById,
  updateTemplateById,
  mapTemplate,
};
