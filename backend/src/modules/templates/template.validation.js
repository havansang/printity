const { PRODUCT_TYPES, SURFACE_KEYS } = require('../../constants/product');
const {
  booleanQuerySchema,
  objectIdSchema,
  z,
} = require('../../utils/validation');

const coordinatePointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const printAreaSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  safeZone: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
  bleed: z
    .object({
      top: z.number().default(0),
      right: z.number().default(0),
      bottom: z.number().default(0),
      left: z.number().default(0),
    })
    .optional(),
  anchor: coordinatePointSchema.optional(),
  cornerRadius: z.number().min(0).optional(),
  unit: z.string().trim().min(1).optional(),
  origin: z.enum(['top-left', 'center']).optional(),
});

const printQuadSchema = z
  .object({
    topLeft: coordinatePointSchema.optional(),
    topRight: coordinatePointSchema.optional(),
    bottomRight: coordinatePointSchema.optional(),
    bottomLeft: coordinatePointSchema.optional(),
  })
  .strict();

const sourceCropSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .strict();

const editorSurfaceSchema = z
  .object({
    sourceType: z.string().trim().min(1).optional(),
    svgUrl: z.string().trim().min(1).optional(),
    sceneWidth: z.number().positive().optional(),
    sceneHeight: z.number().positive().optional(),
    placeholderId: z.string().trim().min(1).optional(),
    printArea: printAreaSchema.optional(),
  })
  .strict();

const transformPolicySchema = z
  .object({
    positionUnit: z.string().trim().min(1).optional(),
    sizeUnit: z.string().trim().min(1).optional(),
    origin: z.enum(['center', 'top-left']).optional(),
    rotationUnit: z.string().trim().min(1).optional(),
    flipSupported: z.boolean().optional(),
    fitMode: z.enum(['contain', 'cover', 'stretch']).optional(),
    requireSimilarAspectRatio: z.boolean().optional(),
    maxAspectRatioDelta: z.number().min(0).optional(),
  })
  .strict();

const availableColorSchema = z
  .object({
    key: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(100),
    hex: z.string().trim().min(1).max(20),
    rgb: z.string().trim().min(1).max(50).nullable().optional(),
    imageUrl: z.string().trim().min(1).max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isLight: z.boolean().optional(),
    isActive: z.boolean().optional(),
    providerVariantIds: z.array(z.number().int().positive()).optional(),
  })
  .strict();

const blankableAssetPathSchema = z.string().trim().optional();

const renderSurfaceSchema = z
  .object({
    outputWidth: z.number().positive().optional(),
    outputHeight: z.number().positive().optional(),
    baseImageUrl: blankableAssetPathSchema,
    printArea: printAreaSchema.optional(),
    printQuad: printQuadSchema.optional(),
    assets: z
      .object({
        maskImageUrl: blankableAssetPathSchema,
        shadowImageUrl: blankableAssetPathSchema,
        highlightImageUrl: blankableAssetPathSchema,
        displacementImageUrl: blankableAssetPathSchema,
        grainImageUrl: blankableAssetPathSchema,
        occlusionImageUrl: blankableAssetPathSchema,
      })
      .strict()
      .optional(),
    blendModes: z
      .object({
        shadow: z.string().trim().min(1).optional(),
        highlight: z.string().trim().min(1).optional(),
        grain: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    displacement: z
      .object({
        neutral: z.number().optional(),
        scaleX: z.number().optional(),
        scaleY: z.number().optional(),
        blur: z.number().min(0).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const previewSceneLayerSchema = z
  .object({
    type: z.string().trim().min(1).optional(),
    surfaceKey: z.enum(SURFACE_KEYS).optional(),
    assetUrl: blankableAssetPathSchema,
    blend: z.string().trim().min(1).optional(),
    inheritSurfaceRender: z.boolean().optional(),
    rotationDeg: z.number().optional(),
    configuredWidth: z.number().positive().optional(),
    configuredHeight: z.number().positive().optional(),
    editorPrintArea: printAreaSchema.optional(),
    sourceCrop: sourceCropSchema.optional(),
    printArea: printAreaSchema.optional(),
    printQuad: printQuadSchema.optional(),
    assets: z
      .object({
        maskImageUrl: blankableAssetPathSchema,
        shadowImageUrl: blankableAssetPathSchema,
        highlightImageUrl: blankableAssetPathSchema,
        displacementImageUrl: blankableAssetPathSchema,
        grainImageUrl: blankableAssetPathSchema,
        occlusionImageUrl: blankableAssetPathSchema,
      })
      .strict()
      .optional(),
    blendModes: z
      .object({
        shadow: z.string().trim().min(1).optional(),
        highlight: z.string().trim().min(1).optional(),
        grain: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    displacement: z
      .object({
        neutral: z.number().optional(),
        scaleX: z.number().optional(),
        scaleY: z.number().optional(),
        blur: z.number().min(0).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const previewSceneRenderSchema = z
  .object({
    baseSurfaceKey: z.enum(SURFACE_KEYS).optional(),
    baseImageUrl: blankableAssetPathSchema,
    basePattern: blankableAssetPathSchema,
    outputWidth: z.number().positive().optional(),
    outputHeight: z.number().positive().optional(),
    layers: z.array(previewSceneLayerSchema).optional(),
    overlays: z.array(previewSceneLayerSchema).optional(),
  })
  .strict();

const previewSceneSchema = z
  .object({
    key: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(100),
    sortOrder: z.number().int().min(0).optional(),
    surfaceKeys: z.array(z.enum(SURFACE_KEYS)).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    render: previewSceneRenderSchema.optional(),
  })
  .strict();

const editorSurfacePatchSchema = z
  .object({
    sourceType: z.string().trim().min(1).optional(),
    svgUrl: z.string().trim().min(1).optional(),
    sceneWidth: z.number().positive().optional(),
    sceneHeight: z.number().positive().optional(),
    placeholderId: z.string().trim().min(1).optional(),
    printArea: printAreaSchema.optional(),
  })
  .strict();

const transformPolicyPatchSchema = z
  .object({
    positionUnit: z.string().trim().min(1).optional(),
    sizeUnit: z.string().trim().min(1).optional(),
    origin: z.enum(['center', 'top-left']).optional(),
    rotationUnit: z.string().trim().min(1).optional(),
    flipSupported: z.boolean().optional(),
    fitMode: z.enum(['contain', 'cover', 'stretch']).optional(),
    requireSimilarAspectRatio: z.boolean().optional(),
    maxAspectRatioDelta: z.number().min(0).optional(),
  })
  .strict();

const renderAssetsPatchSchema = z
  .object({
    maskImageUrl: blankableAssetPathSchema,
    shadowImageUrl: blankableAssetPathSchema,
    highlightImageUrl: blankableAssetPathSchema,
    displacementImageUrl: blankableAssetPathSchema,
    grainImageUrl: blankableAssetPathSchema,
    occlusionImageUrl: blankableAssetPathSchema,
  })
  .strict();

const blendModesPatchSchema = z
  .object({
    shadow: z.string().trim().min(1).optional(),
    highlight: z.string().trim().min(1).optional(),
    grain: z.string().trim().min(1).optional(),
  })
  .strict();

const displacementPatchSchema = z
  .object({
    neutral: z.number().optional(),
    scaleX: z.number().optional(),
    scaleY: z.number().optional(),
    blur: z.number().min(0).optional(),
  })
  .strict();

const renderSurfacePatchSchema = z
  .object({
    outputWidth: z.number().positive().optional(),
    outputHeight: z.number().positive().optional(),
    baseImageUrl: blankableAssetPathSchema,
    printArea: printAreaSchema.optional(),
    printQuad: printQuadSchema.optional(),
    assets: renderAssetsPatchSchema.optional(),
    blendModes: blendModesPatchSchema.optional(),
    displacement: displacementPatchSchema.optional(),
  })
  .strict();

const previewSceneLayerPatchSchema = z
  .object({
    type: z.string().trim().min(1).optional(),
    surfaceKey: z.enum(SURFACE_KEYS).optional(),
    assetUrl: blankableAssetPathSchema,
    blend: z.string().trim().min(1).optional(),
    inheritSurfaceRender: z.boolean().optional(),
    rotationDeg: z.number().optional(),
    configuredWidth: z.number().positive().optional(),
    configuredHeight: z.number().positive().optional(),
    editorPrintArea: printAreaSchema.optional(),
    sourceCrop: sourceCropSchema.optional(),
    printArea: printAreaSchema.optional(),
    printQuad: printQuadSchema.optional(),
    assets: renderAssetsPatchSchema.optional(),
    blendModes: blendModesPatchSchema.optional(),
    displacement: displacementPatchSchema.optional(),
  })
  .strict();

const previewSceneRenderPatchSchema = z
  .object({
    baseSurfaceKey: z.enum(SURFACE_KEYS).optional(),
    baseImageUrl: blankableAssetPathSchema,
    basePattern: blankableAssetPathSchema,
    outputWidth: z.number().positive().optional(),
    outputHeight: z.number().positive().optional(),
    layers: z.array(previewSceneLayerPatchSchema).optional(),
    overlays: z.array(previewSceneLayerPatchSchema).optional(),
  })
  .strict();

const previewScenePatchSchema = z
  .object({
    key: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(100).optional(),
    sortOrder: z.number().int().min(0).optional(),
    surfaceKeys: z.array(z.enum(SURFACE_KEYS)).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    render: previewSceneRenderPatchSchema.optional(),
  })
  .strict();

const templateSurfaceSchema = z
  .object({
    key: z.enum(SURFACE_KEYS).optional(),
    label: z.string().trim().min(1).max(50),
    position: z.string().trim().min(1).max(50).optional(),
    domId: z.array(z.string().trim().min(1)).optional(),
    sequence: z.number().int().min(0).optional(),
    printable: z.boolean().optional(),
    allowedDecorationMethods: z.array(z.string().trim().min(1)).optional(),
    templateImageUrl: z.string().trim().min(1),
    overlayImageUrl: z.string().trim().min(1).optional(),
    maskImageUrl: z.string().trim().min(1).optional(),
    printArea: printAreaSchema,
    editor: editorSurfaceSchema.optional(),
    transformPolicy: transformPolicySchema.optional(),
    render: renderSurfaceSchema.optional(),
  })
  .strict();

const templateSurfacePatchSchema = z
  .object({
    key: z.enum(SURFACE_KEYS).optional(),
    label: z.string().trim().min(1).max(50).optional(),
    position: z.string().trim().min(1).max(50).optional(),
    domId: z.array(z.string().trim().min(1)).optional(),
    sequence: z.number().int().min(0).optional(),
    printable: z.boolean().optional(),
    allowedDecorationMethods: z.array(z.string().trim().min(1)).optional(),
    templateImageUrl: z.string().trim().min(1).optional(),
    overlayImageUrl: z.string().trim().min(1).optional(),
    maskImageUrl: z.string().trim().min(1).optional(),
    printArea: printAreaSchema.optional(),
    editor: editorSurfacePatchSchema.optional(),
    transformPolicy: transformPolicyPatchSchema.optional(),
    render: renderSurfacePatchSchema.optional(),
  })
  .strict();

const templateSeedSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  productType: z.enum(PRODUCT_TYPES),
  description: z.string().trim().max(500).optional(),
  version: z.number().int().positive().optional(),
  mockupPack: z
    .object({
      slug: z.string().trim().min(1).max(100).optional(),
      manifestPath: z.string().trim().min(1).max(500).optional(),
      defaultColorKey: z.string().trim().min(1).max(100).optional(),
    })
    .strict()
    .optional(),
  providerRefs: z
    .object({
      blueprintId: z.number().int().positive().optional(),
      defaultCameraId: z.number().int().positive().optional(),
      defaultDecoratorId: z.number().int().positive().optional(),
    })
    .strict()
    .optional(),
  supportedSurfaces: z.array(z.enum(SURFACE_KEYS)).optional(),
  previewScenes: z.array(previewSceneSchema).optional(),
  surfaces: z.object({
    front: templateSurfaceSchema,
    back: templateSurfaceSchema,
    neckLabelInner: templateSurfaceSchema.optional(),
  }),
  availableColors: z.array(availableColorSchema).optional(),
  thumbnailUrl: z.string().trim().min(1).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  defaultRenderOptions: z
    .object({
      size: z.number().int().positive().optional(),
      format: z.string().trim().min(1).optional(),
      mockupMode: z.string().trim().min(1).optional(),
    })
    .strict()
    .optional(),
});

const listTemplatesQuerySchema = z.object({
  productType: z.enum(PRODUCT_TYPES).optional(),
  activeOnly: booleanQuerySchema.optional().default(true),
});

const templateParamsSchema = z.object({
  id: objectIdSchema,
});

const templateUpdateBodySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  version: z.number().int().positive().optional(),
  mockupPack: z
    .object({
      slug: z.string().trim().min(1).max(100).optional(),
      manifestPath: z.string().trim().min(1).max(500).optional(),
      defaultColorKey: z.string().trim().min(1).max(100).optional(),
    })
    .strict()
    .optional(),
  providerRefs: z
    .object({
      blueprintId: z.number().int().positive().optional(),
      defaultCameraId: z.number().int().positive().optional(),
      defaultDecoratorId: z.number().int().positive().optional(),
    })
    .strict()
    .optional(),
  supportedSurfaces: z.array(z.enum(SURFACE_KEYS)).optional(),
  previewScenes: z.array(previewScenePatchSchema).optional(),
  surfaces: z
    .object({
      front: templateSurfacePatchSchema.optional(),
      back: templateSurfacePatchSchema.optional(),
      neckLabelInner: templateSurfacePatchSchema.optional(),
    })
    .strict()
    .optional(),
  availableColors: z.array(availableColorSchema).optional(),
  thumbnailUrl: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  defaultRenderOptions: z
    .object({
      size: z.number().int().positive().optional(),
      format: z.string().trim().min(1).optional(),
      mockupMode: z.string().trim().min(1).optional(),
    })
    .strict()
    .optional(),
}).strict().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one field is required',
      path: [],
    });
  }
});

module.exports = {
  listTemplatesQuerySchema,
  templateParamsSchema,
  templateUpdateBodySchema,
  templateSeedSchema,
};
