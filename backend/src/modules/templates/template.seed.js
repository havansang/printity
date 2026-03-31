const Template = require('./template.model');
const { PRODUCT_AVAILABLE_COLORS } = require('./template-color.util');
const { templateSeedSchema } = require('./template.validation');

function createPrintArea(config) {
  return {
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
  };
}

function createTransformPolicy(overrides = {}) {
  return {
    positionUnit: 'normalized',
    sizeUnit: 'normalized',
    origin: 'center',
    rotationUnit: 'deg',
    fitMode: 'contain',
    requireSimilarAspectRatio: true,
    maxAspectRatioDelta: 0.01,
    ...overrides,
  };
}

function createEditorConfig(config) {
  return {
    sourceType: config.sourceType || 'svg',
    svgUrl: config.svgUrl,
    sceneWidth: config.sceneWidth,
    sceneHeight: config.sceneHeight,
    placeholderId: config.placeholderId,
    printArea: createPrintArea(config.printArea),
  };
}

function createRenderConfig(config) {
  if (!config) {
    return undefined;
  }

  return {
    outputWidth: config.outputWidth,
    outputHeight: config.outputHeight,
    baseImageUrl: config.baseImageUrl,
    printArea: config.printArea ? createPrintArea(config.printArea) : null,
    printQuad: config.printQuad ? { ...config.printQuad } : undefined,
    assets: config.assets ? { ...config.assets } : undefined,
    blendModes: config.blendModes ? { ...config.blendModes } : undefined,
    displacement: config.displacement ? { ...config.displacement } : undefined,
  };
}

function createPreviewSceneLayer(config) {
  return {
    type: config.type,
    surfaceKey: config.surfaceKey,
    assetUrl: config.assetUrl,
    blend: config.blend,
    inheritSurfaceRender: config.inheritSurfaceRender,
    rotationDeg: config.rotationDeg,
    configuredWidth: config.configuredWidth,
    configuredHeight: config.configuredHeight,
    editorPrintArea: config.editorPrintArea ? createPrintArea(config.editorPrintArea) : undefined,
    sourceCrop: config.sourceCrop ? createPrintArea(config.sourceCrop) : undefined,
    printArea: config.printArea ? createPrintArea(config.printArea) : undefined,
    printQuad: config.printQuad ? { ...config.printQuad } : undefined,
    assets: config.assets ? { ...config.assets } : undefined,
    blendModes: config.blendModes ? { ...config.blendModes } : undefined,
    displacement: config.displacement ? { ...config.displacement } : undefined,
  };
}

function createPreviewSceneRender(config) {
  if (!config) {
    return undefined;
  }

  return {
    baseSurfaceKey: config.baseSurfaceKey,
    baseImageUrl: config.baseImageUrl,
    basePattern: config.basePattern,
    outputWidth: config.outputWidth,
    outputHeight: config.outputHeight,
    layers: Array.isArray(config.layers) ? config.layers.map(createPreviewSceneLayer) : undefined,
    overlays: Array.isArray(config.overlays) ? config.overlays.map(createPreviewSceneLayer) : undefined,
  };
}

function createSurfaceConfig(config) {
  return {
    key: config.key,
    label: config.label,
    position: config.position,
    domId: [...config.domId],
    printable: config.printable,
    allowedDecorationMethods: [...config.allowedDecorationMethods],
    templateImageUrl: config.templateImageUrl,
    printArea: createPrintArea(config.printArea),
    editor: createEditorConfig(config.editor),
    transformPolicy: createTransformPolicy(config.transformPolicy),
    render: createRenderConfig(config.render),
  };
}

function createPreviewScene(config) {
  return {
    key: config.key,
    label: config.label,
    sortOrder: config.sortOrder,
    surfaceKeys: [...config.surfaceKeys],
    isDefault: config.isDefault,
    isActive: config.isActive,
    render: createPreviewSceneRender(config.render),
  };
}

function createTemplateSeed(config) {
  return {
    name: config.name,
    slug: config.slug,
    productType: config.productType,
    description: config.description,
    version: config.version,
    mockupPack: {
      slug: config.mockupPack.slug,
      manifestPath: config.mockupPack.manifestPath,
      defaultColorKey: config.mockupPack.defaultColorKey,
    },
    thumbnailUrl: config.thumbnailUrl,
    supportedSurfaces: [...config.supportedSurfaces],
    previewScenes: config.previewScenes.map(createPreviewScene),
    availableColors: config.availableColors,
    defaultRenderOptions: {
      size: config.defaultRenderOptions.size,
      format: config.defaultRenderOptions.format,
      mockupMode: config.defaultRenderOptions.mockupMode,
    },
    surfaces: Object.fromEntries(
      Object.entries(config.surfaces).map(([surfaceKey, surfaceConfig]) => [surfaceKey, createSurfaceConfig(surfaceConfig)])
    ),
    isActive: config.isActive,
    sortOrder: config.sortOrder,
  };
}

function createEmptySceneLayerAssets() {
  return {
    maskImageUrl: '',
    shadowImageUrl: '',
    highlightImageUrl: '',
    displacementImageUrl: '',
    grainImageUrl: '',
    occlusionImageUrl: '',
  };
}

/*
 * Fill real data in the blocks below.
 * Keep the overall shape the same so the seed and manifest stay aligned.
 * Existing values are preserved intentionally.
 */

const TSHIRT_PREVIEW_SCENES = [
  {
    key: 'front',
    label: 'Front',
    sortOrder: 0,
    surfaceKeys: ['front', 'neckLabelInner'],
    isDefault: true,
    isActive: true,
    render: {
      baseSurfaceKey: 'front',
      basePattern: '/mockups/basic-tshirt/scenes/front/colors/{colorKey}/base.png',
      baseImageUrl: '/mockups/basic-tshirt/scenes/front/base.png',
      outputWidth: 2048,
      outputHeight: 2048,
      layers: [
        {
          type: 'surface',
          surfaceKey: 'front',
          inheritSurfaceRender: false,
          printArea: { x: 675.5, y: 526, width: 697, height: 902 },
          assets: {
            maskImageUrl: '/mockups/basic-tshirt/scenes/front/layers/front/mask.png',
            shadowImageUrl: '/mockups/basic-tshirt/scenes/front/layers/front/shadow.png',
            highlightImageUrl: '/mockups/basic-tshirt/scenes/front/layers/front/highlight.png',
            displacementImageUrl: '/mockups/basic-tshirt/scenes/front/layers/front/displacement.png',
            grainImageUrl: '/mockups/basic-tshirt/scenes/front/layers/front/grain.svg',
            occlusionImageUrl: '/mockups/basic-tshirt/scenes/front/layers/front/occlusion.svg',
          },
          blendModes: {
            shadow: 'multiply',
            highlight: 'screen',
            grain: 'soft-light',
          },
          displacement: {
            neutral: 128,
            scaleX: 0,
            scaleY: 0,
            blur: 0,
          },
        },
        {
          type: 'surface',
          surfaceKey: 'neckLabelInner',
          inheritSurfaceRender: false,
          printArea: { x: 967, y: 363, width: 116.45, height: 116.45 },
          // Fill real front-scene neck assets under /mockups/basic-tshirt/scenes/front/layers/neck-label-inner/.
          assets: {
            maskImageUrl: '/mockups/basic-tshirt/scenes/front/layers/neck-label-inner/mask.png',
            shadowImageUrl: '/mockups/basic-tshirt/scenes/front/layers/neck-label-inner/shadow.png',
            highlightImageUrl: '/mockups/basic-tshirt/scenes/front/layers/neck-label-inner/highlight.png',
            displacementImageUrl: '/mockups/basic-tshirt/scenes/front/layers/neck-label-inner/displacement.png',
            grainImageUrl: '/mockups/basic-tshirt/scenes/front/layers/neck-label-inner/grain.svg',
            occlusionImageUrl: '/mockups/basic-tshirt/scenes/front/layers/neck-label-inner/occlusion.png',
          }
        }
      ],
    },
  },
  {
    key: 'back',
    label: 'Back',
    sortOrder: 1,
    surfaceKeys: ['back'],
    isDefault: false,
    isActive: true,
    render: {
      baseSurfaceKey: 'back',
      basePattern: '/mockups/basic-tshirt/scenes/back/colors/{colorKey}/base.png',
      baseImageUrl: '/mockups/basic-tshirt/scenes/back/base.png',
      outputWidth: 2048,
      outputHeight: 2048,
      layers: [
        {
          type: 'surface',
          surfaceKey: 'back',
          inheritSurfaceRender: false,
          printArea: { x: 671.5, y: 613, width: 705, height: 893 },
          assets: {
            maskImageUrl: '/mockups/basic-tshirt/scenes/back/layers/back/mask.png',
            shadowImageUrl: '/mockups/basic-tshirt/scenes/back/layers/back/shadow.png',
            highlightImageUrl: '/mockups/basic-tshirt/scenes/back/layers/back/highlight.png',
            displacementImageUrl: '/mockups/basic-tshirt/scenes/back/layers/back/displacement.png',
          },
          blendModes: {
            shadow: 'multiply',
            highlight: 'screen',
            grain: 'soft-light',
          },
          displacement: {
            neutral: 128,
            scaleX: 0,
            scaleY: 0,
            blur: 2,
          },
        },
      ],
    },
  },
  {
    key: 'frontCollarCloseup',
    label: 'Front Collar Closeup',
    sortOrder: 2,
    surfaceKeys: ['neckLabelInner'],
    isDefault: false,
    isActive: true,
    render: {
      basePattern: '/mockups/basic-tshirt/scenes/front-collar-closeup/colors/{colorKey}/base.png',
      // Fill a generic fallback base here only if you need one outside the color pattern.
      baseImageUrl: '/mockups/basic-tshirt/scenes/front-collar-closeup/base.png',
      outputWidth: 2048,
      outputHeight: 2048,
      layers: [
        {
          type: 'surface',
          surfaceKey: 'neckLabelInner',
          inheritSurfaceRender: false,
          rotationDeg: 13,
          printArea: { x: 693.25, y: 716.53, width: 480.31, height: 480.31 },
          printQuad: {
            topLeft: { x: 801, y: 716 },
            topRight: { x: 1269, y: 824 },
            bottomRight: { x: 1161, y: 1293 },
            bottomLeft: { x: 692, y: 1185 },
          },
          // Fill real collar-closeup neck assets under /mockups/basic-tshirt/scenes/front-collar-closeup/layers/neck-label-inner/.
          assets:{
            maskImageUrl: '/mockups/basic-tshirt/scenes/front-collar-closeup/layers/neck-label-inner/mask.png',
            shadowImageUrl: '/mockups/basic-tshirt/scenes/front-collar-closeup/layers/neck-label-inner/shadow.png',
            highlightImageUrl: '/mockups/basic-tshirt/scenes/front-collar-closeup/layers/neck-label-inner/highlight.png',
            displacementImageUrl: '/mockups/basic-tshirt/scenes/front-collar-closeup/layers/neck-label-inner/displacement.png',
            grainImageUrl: '/mockups/basic-tshirt/scenes/front-collar-closeup/layers/neck-label-inner/grain.svg',
            occlusionImageUrl: '/mockups/basic-tshirt/scenes/front-collar-closeup/layers/neck-label-inner/occlusion.png',
          },
        },
      ],
    },
  },
  {
    key: 'folded',
    label: 'Folded',
    sortOrder: 3,
    surfaceKeys: ['front', 'neckLabelInner'],
    isDefault: false,
    isActive: true,
    render: {
      basePattern: '/mockups/basic-tshirt/scenes/folded/colors/{colorKey}/base.png',
      // Fill a generic fallback base here only if you need one outside the color pattern.
      baseImageUrl: '',
      outputWidth: 2048,
      outputHeight: 2048,
      layers: [
        {
          type: 'surface',
          surfaceKey: 'front',
          inheritSurfaceRender: false,
          configuredWidth: 2048,
          configuredHeight: 2048,
          printArea: { x: 0, y: 0, width: 1263, height: 850 },
          sourceCrop: { x: 0, y: 0, width: 1, height: 0.52 },
          printQuad: {
            topLeft: { x: 542, y: 709 },
            topRight: { x: 1582.62, y: 1078.26 },
            bottomRight: { x: 1315.41, y: 1780.8 },
            bottomLeft: { x: 275.2, y: 1394.4 },
          },
          // Fill real folded-scene front assets under /mockups/basic-tshirt/scenes/folded/layers/front/.
          assets: {
            maskImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/front/mask.png',
            shadowImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/front/shadow.png',
            highlightImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/front/highlight.png',
            displacementImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/front/displacement.png',
            grainImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/front/grain.svg',
            occlusionImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/front/occlusion.png',
          },
        },
        {
          type: 'surface',
          surfaceKey: 'neckLabelInner',
          inheritSurfaceRender: false,
          configuredWidth: 2048,
          configuredHeight: 2048,
          printArea: { x: 0, y: 0, width: 188.08, height: 188.08 },
          printQuad: {
            topLeft: { x: 1106, y: 489 },
            topRight: { x: 1282, y: 556 },
            bottomRight: { x: 1216, y: 732 },
            bottomLeft: { x: 1040, y: 665 },
          },
          // Fill real folded-scene neck assets under /mockups/basic-tshirt/scenes/folded/layers/neck-label-inner/.
          assets: {
            maskImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/neck-label-inner/mask.png',
            shadowImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/neck-label-inner/shadow.png',
            highlightImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/neck-label-inner/highlight.png',
            displacementImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/neck-label-inner/displacement.png',
            grainImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/neck-label-inner/grain.svg',
            occlusionImageUrl: '/mockups/basic-tshirt/scenes/folded/layers/neck-label-inner/occlusion.png',
          },
        },
      ],
    },
  },
];

const TSHIRT_SURFACES = {
  front: {
    key: 'front',
    label: 'Front',
    position: 'front',
    domId: ['#placeholder_front'],
    printable: true,
    allowedDecorationMethods: ['dtg', 'dtf'],
    templateImageUrl: '/mockups/basic-tshirt/surfaces/front/template.svg',
    printArea: { x: 934.29, y: 784.29, width: 1700, height: 2200 },
    editor: {
      sourceType: 'svg',
      svgUrl: '/mockups/basic-tshirt/surfaces/front/editor.svg',
      sceneWidth: 3568.58,
      sceneHeight: 3568.58,
      placeholderId: 'placeholder_front',
      printArea: { x: 934.29, y: 784.29, width: 1700, height: 2200 },
    },
    transformPolicy: createTransformPolicy(),
  },
  back: {
    key: 'back',
    label: 'Back',
    position: 'back',
    domId: ['#placeholder_back'],
    printable: true,
    allowedDecorationMethods: ['dtg', 'dtf'],
    templateImageUrl: '/mockups/basic-tshirt/surfaces/back/template.svg',
    printArea: { x: 1034.29, y: 800, width: 1500, height: 1900 },
    editor: {
      sourceType: 'svg',
      svgUrl: '/mockups/basic-tshirt/surfaces/back/editor.svg',
      sceneWidth: 3568.58,
      sceneHeight: 3568.58,
      placeholderId: 'placeholder_back',
      printArea: { x: 1034.29, y: 800, width: 1500, height: 1900 },
    },
    transformPolicy: createTransformPolicy(),
  },
  neckLabelInner: {
    key: 'neckLabelInner',
    label: 'Neck Label Inner',
    position: 'neck',
    domId: ['#placeholder_necktag'],
    printable: true,
    allowedDecorationMethods: ['dtg', 'dtf'],
    templateImageUrl: '/mockups/basic-tshirt/surfaces/neck-label-inner/template.svg',
    printArea: { x: 285.555, y: 250, width: 300, height: 300 },
    editor: {
      sourceType: 'svg',
      svgUrl: '/mockups/basic-tshirt/surfaces/neck-label-inner/editor.svg',
      sceneWidth: 877.11,
      sceneHeight: 871.85,
      placeholderId: 'placeholder_necktag',
      printArea: { x: 285.555, y: 250, width: 300, height: 300 },
    },
    transformPolicy: createTransformPolicy(),
  },
};

const POLO_PREVIEW_SCENES = [
  {
    key: 'front',
    label: 'Front',
    sortOrder: 0,
    surfaceKeys: ['front'],
    isDefault: true,
    isActive: true,
    render: {
      baseSurfaceKey: 'front',
      basePattern: '/mockups/basic-polo/scenes/front/colors/{colorKey}/base.png',
      baseImageUrl: '/mockups/basic-polo/scenes/front/base.png',
      layers: [
        {
          type: 'surface',
          surfaceKey: 'front',
          printArea: { x: 1107, y: 520, width: 210, height: 210 },
          inheritSurfaceRender: false,
          assets: {
            maskImageUrl: '/mockups/basic-polo/scenes/front/layers/front/mask.png',
            shadowImageUrl: '/mockups/basic-polo/scenes/front/layers/front/shadow.png',
            highlightImageUrl: '/mockups/basic-polo/scenes/front/layers/front/highlight.png',
          },
        },
      ],
    },
  },
  {
    key: 'back',
    label: 'Back',
    sortOrder: 1,
    surfaceKeys: ['back'],
    isDefault: false,
    isActive: true,
    render: {
      baseSurfaceKey: 'back',
      basePattern: '/mockups/basic-polo/scenes/back/colors/{colorKey}/base.png',
      baseImageUrl: '/mockups/basic-polo/scenes/back/base.png',
      layers: [
        {
          type: 'surface',
          surfaceKey: 'back',
          printArea: { x: 635.5, y: 490, width: 777, height: 888 },
          inheritSurfaceRender: false,
          assets: {
            maskImageUrl: '/mockups/basic-polo/scenes/back/layers/back/mask.png',
            shadowImageUrl: '/mockups/basic-polo/scenes/back/layers/back/shadow.png',
            highlightImageUrl: '/mockups/basic-polo/scenes/back/layers/back/highlight.png',
          },
        },
      ],
    },
  },
];

const POLO_SURFACES = {
  front: {
    key: 'front',
    label: 'Front',
    position: 'front',
    domId: ['#placeholder_front'],
    printable: true,
    allowedDecorationMethods: ['dtg', 'dtf'],
    templateImageUrl: '/mockups/basic-polo/surfaces/front/template.svg',
    printArea: { x: 1840, y: 750, width: 400, height: 400 },
    editor: {
      sourceType: 'svg',
      svgUrl: '/mockups/basic-polo/surfaces/front/editor.svg',
      sceneWidth: 3372.31,
      sceneHeight: 3372.31,
      placeholderId: 'placeholder_front',
      printArea: { x: 1840, y: 750, width: 400, height: 400 },
    },
    transformPolicy: createTransformPolicy(),
    render: {
      outputWidth: 2048,
      outputHeight: 2048,
      baseImageUrl: '/mockups/basic-polo/scenes/front/base.png',
      printArea: { x: 1107, y: 520, width: 210, height: 210 },
      assets: {
        maskImageUrl: '/mockups/basic-polo/scenes/front/layers/front/mask.png',
        shadowImageUrl: '/mockups/basic-polo/scenes/front/layers/front/shadow.png',
        highlightImageUrl: '/mockups/basic-polo/scenes/front/layers/front/highlight.png',
      },
    },
  },
  back: {
    key: 'back',
    label: 'Back',
    position: 'back',
    domId: ['#placeholder_back'],
    printable: true,
    allowedDecorationMethods: ['dtg', 'dtf'],
    templateImageUrl: '/mockups/basic-polo/surfaces/back/template.svg',
    printArea: { x: 993.63, y: 620, width: 1400, height: 1600 },
    editor: {
      sourceType: 'svg',
      svgUrl: '/mockups/basic-polo/surfaces/back/editor.svg',
      sceneWidth: 3372.31,
      sceneHeight: 3372.31,
      placeholderId: 'placeholder_back',
      printArea: { x: 993.63, y: 620, width: 1400, height: 1600 },
    },
    transformPolicy: createTransformPolicy(),
    render: {
      outputWidth: 2048,
      outputHeight: 2048,
      baseImageUrl: '/mockups/basic-polo/scenes/back/base.png',
      printArea: { x: 635.5, y: 490, width: 777, height: 888 },
      assets: {
        maskImageUrl: '/mockups/basic-polo/scenes/back/layers/back/mask.png',
        shadowImageUrl: '/mockups/basic-polo/scenes/back/layers/back/shadow.png',
        highlightImageUrl: '/mockups/basic-polo/scenes/back/layers/back/highlight.png',
      },
    },
  },
};

const defaultTemplates = [
  createTemplateSeed({
    name: 'Basic T-shirt',
    slug: 'basic-tshirt',
    productType: 'tshirt',
    description: 'Default front/back t-shirt template for the design editor.',
    version: 1,
    mockupPack: {
      slug: 'basic-tshirt',
      manifestPath: '/mockups/basic-tshirt/manifest.json',
      defaultColorKey: 'white',
    },
    thumbnailUrl: '/mockups/basic-tshirt/thumbnail.svg',
    supportedSurfaces: ['front', 'back', 'neckLabelInner'],
    previewScenes: TSHIRT_PREVIEW_SCENES,
    availableColors: PRODUCT_AVAILABLE_COLORS.tshirt,
    defaultRenderOptions: {
      size: 2048,
      format: 'jpeg',
      mockupMode: 'RGB',
    },
    surfaces: TSHIRT_SURFACES,
    isActive: true,
    sortOrder: 1,
  }),
  createTemplateSeed({
    name: 'Basic Polo',
    slug: 'basic-polo',
    productType: 'polo',
    description: 'Default front/back polo template for the design editor.',
    version: 1,
    mockupPack: {
      slug: 'basic-polo',
      manifestPath: '/mockups/basic-polo/manifest.json',
      defaultColorKey: 'white',
    },
    thumbnailUrl: '/mockups/basic-polo/thumbnail.svg',
    supportedSurfaces: ['front', 'back'],
    previewScenes: POLO_PREVIEW_SCENES,
    availableColors: PRODUCT_AVAILABLE_COLORS.polo,
    defaultRenderOptions: {
      size: 2048,
      format: 'jpeg',
      mockupMode: 'RGB',
    },
    surfaces: POLO_SURFACES,
    isActive: true,
    sortOrder: 2,
  }),
];

async function seedDefaultTemplates() {
  const items = [];

  for (const template of defaultTemplates) {
    const parsedTemplate = templateSeedSchema.parse(template);

    await Template.findOneAndUpdate(
      { slug: parsedTemplate.slug },
      { $set: parsedTemplate },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    items.push(parsedTemplate.slug);
  }

  return {
    count: items.length,
    items,
  };
}

module.exports = {
  defaultTemplates,
  seedDefaultTemplates,
};
