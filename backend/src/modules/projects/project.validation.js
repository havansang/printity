const { PRODUCT_TYPES, SURFACE_KEYS } = require('../../constants/product');
const { PROJECT_STATUSES } = require('../../constants/project');
const {
  createNullableStringSchema,
  createPositiveIntegerQuerySchema,
  jsonObjectSchema,
  objectIdSchema,
  z,
} = require('../../utils/validation');

const PROJECT_RENDER_STATUSES = ['idle', 'queued', 'processing', 'ready', 'failed'];
const nullableJsonObjectSchema = z.union([jsonObjectSchema, z.null()]);

const selectionSchema = z
  .object({
    variantId: z.number().int().positive().optional(),
    cameraId: z.number().int().positive().optional(),
    blueprintId: z.number().int().positive().optional(),
    decoratorId: z.number().int().positive().optional(),
  })
  .strict();

const renderOptionsSchema = z
  .object({
    size: z.number().int().positive().optional(),
    format: z.string().trim().min(1).max(20).optional(),
    mockupMode: z.string().trim().min(1).max(20).optional(),
    mirror: z.boolean().optional(),
    printOnSide: z.boolean().optional(),
    canvas: z.boolean().optional(),
    fontColor: z.string().trim().min(1).max(50).optional(),
    country: z.string().trim().min(1).max(100).optional(),
    newEmbroideryColorPalette: z.boolean().optional(),
  })
  .strict();

const surfaceSchema = z
  .object({
    canvasJson: nullableJsonObjectSchema.optional(),
    previewImageUrl: createNullableStringSchema(500).optional(),
    designCompositeUrl: createNullableStringSchema(500).optional(),
    designCompositeWidth: z.number().int().positive().nullable().optional(),
    designCompositeHeight: z.number().int().positive().nullable().optional(),
    renderStatus: z.enum(PROJECT_RENDER_STATUSES).optional(),
    renderHash: createNullableStringSchema(255).optional(),
  })
  .strict();

const surfacesSchema = z
  .object({
    front: surfaceSchema.optional(),
    back: surfaceSchema.optional(),
    neckLabelInner: surfaceSchema.optional(),
  })
  .strict();

function hasSurfacePayload(surfaces) {
  return SURFACE_KEYS.some((key) => Boolean(surfaces?.[key] && Object.keys(surfaces[key]).length > 0));
}

const createProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    templateId: objectIdSchema,
    surfaces: surfacesSchema.optional(),
    frontCanvasJson: nullableJsonObjectSchema.optional(),
    backCanvasJson: nullableJsonObjectSchema.optional(),
    neckLabelInnerCanvasJson: nullableJsonObjectSchema.optional(),
    selection: selectionSchema.nullable().optional(),
    renderOptions: renderOptionsSchema.nullable().optional(),
    printPayloadRaw: nullableJsonObjectSchema.optional(),
    printPayloadNormalized: nullableJsonObjectSchema.optional(),
    thumbnailUrl: createNullableStringSchema(500).optional(),
    lastRenderedAt: z.coerce.date().nullable().optional(),
  })
  .strict();

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    templateId: objectIdSchema.optional(),
    surfaces: surfacesSchema.optional(),
    frontCanvasJson: nullableJsonObjectSchema.optional(),
    backCanvasJson: nullableJsonObjectSchema.optional(),
    neckLabelInnerCanvasJson: nullableJsonObjectSchema.optional(),
    selection: selectionSchema.nullable().optional(),
    renderOptions: renderOptionsSchema.nullable().optional(),
    printPayloadRaw: nullableJsonObjectSchema.optional(),
    printPayloadNormalized: nullableJsonObjectSchema.optional(),
    thumbnailUrl: createNullableStringSchema(500).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    lastOpenedAt: z.coerce.date().optional(),
    lastRenderedAt: z.coerce.date().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasSurfaceFields = hasSurfacePayload(value.surfaces);
    const hasOtherFields =
      Object.prototype.hasOwnProperty.call(value, 'name') ||
      Object.prototype.hasOwnProperty.call(value, 'templateId') ||
      Object.prototype.hasOwnProperty.call(value, 'frontCanvasJson') ||
      Object.prototype.hasOwnProperty.call(value, 'backCanvasJson') ||
      Object.prototype.hasOwnProperty.call(value, 'neckLabelInnerCanvasJson') ||
      Object.prototype.hasOwnProperty.call(value, 'selection') ||
      Object.prototype.hasOwnProperty.call(value, 'renderOptions') ||
      Object.prototype.hasOwnProperty.call(value, 'printPayloadRaw') ||
      Object.prototype.hasOwnProperty.call(value, 'printPayloadNormalized') ||
      Object.prototype.hasOwnProperty.call(value, 'thumbnailUrl') ||
      Object.prototype.hasOwnProperty.call(value, 'status') ||
      Object.prototype.hasOwnProperty.call(value, 'lastOpenedAt') ||
      Object.prototype.hasOwnProperty.call(value, 'lastRenderedAt');

    if (!hasSurfaceFields && !hasOtherFields) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided',
        path: [],
      });
    }
  });

const autosaveProjectSchema = z
  .object({
    surfaces: surfacesSchema.optional(),
    frontCanvasJson: nullableJsonObjectSchema.optional(),
    backCanvasJson: nullableJsonObjectSchema.optional(),
    neckLabelInnerCanvasJson: nullableJsonObjectSchema.optional(),
    selection: selectionSchema.nullable().optional(),
    renderOptions: renderOptionsSchema.nullable().optional(),
    printPayloadRaw: nullableJsonObjectSchema.optional(),
    printPayloadNormalized: nullableJsonObjectSchema.optional(),
    thumbnailUrl: createNullableStringSchema(500).optional(),
    lastOpenedAt: z.coerce.date().optional(),
    lastRenderedAt: z.coerce.date().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasSurfaceData =
      hasSurfacePayload(value.surfaces) ||
      Object.prototype.hasOwnProperty.call(value, 'frontCanvasJson') ||
      Object.prototype.hasOwnProperty.call(value, 'backCanvasJson') ||
      Object.prototype.hasOwnProperty.call(value, 'neckLabelInnerCanvasJson');
    const hasOtherData =
      Object.prototype.hasOwnProperty.call(value, 'selection') ||
      Object.prototype.hasOwnProperty.call(value, 'renderOptions') ||
      Object.prototype.hasOwnProperty.call(value, 'printPayloadRaw') ||
      Object.prototype.hasOwnProperty.call(value, 'printPayloadNormalized') ||
      Object.prototype.hasOwnProperty.call(value, 'thumbnailUrl') ||
      Object.prototype.hasOwnProperty.call(value, 'lastOpenedAt') ||
      Object.prototype.hasOwnProperty.call(value, 'lastRenderedAt');

    if (!hasSurfaceData && !hasOtherData) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one autosave field must be provided',
        path: [],
      });
    }
  });

const projectParamsSchema = z.object({
  id: objectIdSchema,
});

const listProjectsQuerySchema = z.object({
  page: createPositiveIntegerQuerySchema({ defaultValue: 1, min: 1, max: 100000 }).default(1),
  limit: createPositiveIntegerQuerySchema({ defaultValue: 10, min: 1, max: 100 }).default(10),
  search: z.string().trim().max(100).optional(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  sortBy: z.enum(['updatedAt', 'createdAt', 'name', 'lastOpenedAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

module.exports = {
  createProjectSchema,
  updateProjectSchema,
  autosaveProjectSchema,
  projectParamsSchema,
  listProjectsQuerySchema,
};
