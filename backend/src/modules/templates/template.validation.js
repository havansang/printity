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

const renderSurfaceSchema = z
  .object({
    outputWidth: z.number().positive().optional(),
    outputHeight: z.number().positive().optional(),
    baseImageUrl: z.string().trim().min(1).optional(),
    printArea: printAreaSchema.optional(),
    printQuad: printQuadSchema.optional(),
    assets: z
      .object({
        maskImageUrl: z.string().trim().min(1).optional(),
        shadowImageUrl: z.string().trim().min(1).optional(),
        highlightImageUrl: z.string().trim().min(1).optional(),
        displacementImageUrl: z.string().trim().min(1).optional(),
        grainImageUrl: z.string().trim().min(1).optional(),
        occlusionImageUrl: z.string().trim().min(1).optional(),
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

const templateSeedSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  productType: z.enum(PRODUCT_TYPES),
  description: z.string().trim().max(500).optional(),
  version: z.number().int().positive().optional(),
  providerRefs: z
    .object({
      blueprintId: z.number().int().positive().optional(),
      defaultCameraId: z.number().int().positive().optional(),
      defaultDecoratorId: z.number().int().positive().optional(),
    })
    .strict()
    .optional(),
  supportedSurfaces: z.array(z.enum(SURFACE_KEYS)).optional(),
  surfaces: z.object({
    front: templateSurfaceSchema,
    back: templateSurfaceSchema,
    neckLabelInner: templateSurfaceSchema.optional(),
  }),
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

module.exports = {
  listTemplatesQuerySchema,
  templateParamsSchema,
  templateSeedSchema,
};
