const { PRODUCT_TYPES } = require('../../constants/product');
const {
  booleanQuerySchema,
  objectIdSchema,
  z,
} = require('../../utils/validation');

const printAreaSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const templateSurfaceSchema = z.object({
  label: z.string().trim().min(1).max(50),
  templateImageUrl: z.string().trim().min(1),
  overlayImageUrl: z.string().trim().min(1).optional(),
  maskImageUrl: z.string().trim().min(1).optional(),
  printArea: printAreaSchema,
});

const templateSeedSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  productType: z.enum(PRODUCT_TYPES),
  description: z.string().trim().max(500).optional(),
  surfaces: z.object({
    front: templateSurfaceSchema,
    back: templateSurfaceSchema,
  }),
  thumbnailUrl: z.string().trim().min(1).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
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
