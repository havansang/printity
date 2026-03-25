const { booleanQuerySchema, z } = require('../../utils/validation');

const listFontsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  includeVariants: booleanQuerySchema.optional().default(true),
});

const fontParamsSchema = z.object({
  family: z.string().trim().min(1),
});

module.exports = {
  fontParamsSchema,
  listFontsQuerySchema,
};
