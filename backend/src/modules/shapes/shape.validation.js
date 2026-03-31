const { SHAPE_GROUPS } = require('../../constants/shape');
const { booleanQuerySchema, z } = require('../../utils/validation');

const shapeSeedSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: z.string().trim().min(1).max(100),
    group: z.enum(SHAPE_GROUPS).default('basic'),
    tags: z.array(z.string().trim().min(1).max(50)).default([]),
    geometry: z
      .object({
        pathCommands: z.string().trim().min(1),
        defaultWidth: z.number().positive(),
        defaultHeight: z.number().positive(),
      })
      .strict(),
    previewUrl: z.string().trim().min(1).max(500).optional(),
    source: z
      .object({
        provider: z.string().trim().min(1).max(50),
        externalId: z.string().trim().min(1).max(100),
      })
      .strict()
      .optional(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();

const listShapesQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  activeOnly: booleanQuerySchema.optional().default(true),
  group: z.enum(SHAPE_GROUPS).optional(),
});

const shapeParamsSchema = z.object({
  slug: z.string().trim().min(1).max(100),
});

module.exports = {
  listShapesQuerySchema,
  shapeParamsSchema,
  shapeSeedSchema,
};
