const { PRODUCT_TYPES } = require('../../constants/product');
const { PROJECT_STATUSES } = require('../../constants/project');
const {
  createNullableStringSchema,
  createPositiveIntegerQuerySchema,
  jsonObjectSchema,
  objectIdSchema,
  z,
} = require('../../utils/validation');

const surfaceSchema = z
  .object({
    canvasJson: jsonObjectSchema.optional(),
    previewImageUrl: createNullableStringSchema(500).optional(),
  })
  .strict();

const surfacesSchema = z
  .object({
    front: surfaceSchema.optional(),
    back: surfaceSchema.optional(),
  })
  .strict();

const createProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    templateId: objectIdSchema,
    surfaces: surfacesSchema.optional(),
    frontCanvasJson: jsonObjectSchema.optional(),
    backCanvasJson: jsonObjectSchema.optional(),
    thumbnailUrl: createNullableStringSchema(500).optional(),
  })
  .strict();

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    templateId: objectIdSchema.optional(),
    surfaces: surfacesSchema.optional(),
    frontCanvasJson: jsonObjectSchema.optional(),
    backCanvasJson: jsonObjectSchema.optional(),
    thumbnailUrl: createNullableStringSchema(500).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasSurfaceFields =
      Boolean(value.surfaces?.front && Object.keys(value.surfaces.front).length > 0) ||
      Boolean(value.surfaces?.back && Object.keys(value.surfaces.back).length > 0);
    const hasOtherFields =
      Object.prototype.hasOwnProperty.call(value, 'name') ||
      Object.prototype.hasOwnProperty.call(value, 'templateId') ||
      Object.prototype.hasOwnProperty.call(value, 'frontCanvasJson') ||
      Object.prototype.hasOwnProperty.call(value, 'backCanvasJson') ||
      Object.prototype.hasOwnProperty.call(value, 'thumbnailUrl') ||
      Object.prototype.hasOwnProperty.call(value, 'status');

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
    frontCanvasJson: jsonObjectSchema.optional(),
    backCanvasJson: jsonObjectSchema.optional(),
    thumbnailUrl: createNullableStringSchema(500).optional(),
    lastOpenedAt: z.coerce.date().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasSurfaceData =
      Boolean(value.surfaces?.front && Object.keys(value.surfaces.front).length > 0) ||
      Boolean(value.surfaces?.back && Object.keys(value.surfaces.back).length > 0) ||
      Boolean(value.frontCanvasJson) ||
      Boolean(value.backCanvasJson);
    const hasOtherData = Object.prototype.hasOwnProperty.call(value, 'thumbnailUrl') || Boolean(value.lastOpenedAt);

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
