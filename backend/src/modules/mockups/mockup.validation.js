const { SURFACE_KEYS } = require('../../constants/product');
const { objectIdSchema, z } = require('../../utils/validation');
const DEBUG_STAGE_KEYS = ['base', 'design', 'masked', 'warped', 'shadowed', 'final'];

const layerSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    angle: z.number().optional(),
    scale: z.number().positive().optional(),
    flipX: z.boolean().optional(),
    flipY: z.boolean().optional(),
    layerType: z.string().trim().min(1).optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    src: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    sourceMimeType: z.string().trim().min(1).optional(),
    fileName: z.string().trim().min(1).optional(),
    pathCommands: z.string().trim().min(1).optional(),
    fill: z
      .object({
        type: z.string().trim().min(1).optional(),
        color: z.string().trim().min(1).optional(),
      })
      .passthrough()
      .optional(),
    stroke: z
      .union([
        z.null(),
        z.string(),
        z
          .object({
            color: z.string().trim().min(1).optional(),
            width: z.number().nonnegative().optional(),
          })
          .passthrough(),
      ])
      .optional(),
    strokeWidth: z.number().nonnegative().optional(),
    color: z.string().trim().min(1).optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    textInput: z.string().optional(),
    fontFamily: z.string().trim().min(1).optional(),
    fontWeight: z.union([z.string(), z.number()]).optional(),
    fontStyle: z.string().trim().min(1).optional(),
    lineHeight: z.number().positive().optional(),
    baselineFontSize: z.number().positive().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const placeholderSchema = z
  .object({
    dom_id: z.array(z.string().trim().min(1)).optional(),
    images: z.array(layerSchema).default([]),
    position: z.string().trim().min(1).optional(),
    sequence: z.number().int().optional(),
    printable: z.boolean().optional(),
    decoration_method: z.string().trim().min(1).optional(),
  })
  .passthrough();

const mockupPreviewSchema = z
  .object({
    templateId: objectIdSchema,
    print: z
      .object({
        placeholders: z.array(placeholderSchema).default([]),
      })
      .passthrough(),
    surfaceKey: z.enum(SURFACE_KEYS).optional(),
    responseType: z.enum(['json', 'binary']).default('json'),
    format: z.enum(['png', 'jpeg', 'jpg', 'webp']).optional(),
    size: z.coerce.number().int().positive().max(4096).optional(),
    colorKey: z.string().trim().min(1).max(100).optional(),
    shirtColor: z.string().trim().min(1).optional(),
    debug: z.boolean().optional().default(false),
    debugStages: z.array(z.enum(DEBUG_STAGE_KEYS)).optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.responseType === 'binary' && !value.surfaceKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'surfaceKey is required when responseType is binary',
        path: ['surfaceKey'],
      });
    }

    if (value.responseType === 'binary' && (value.debug || (Array.isArray(value.debugStages) && value.debugStages.length > 0))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'debug mode is only supported when responseType is json',
        path: ['debug'],
      });
    }
  });

module.exports = {
  mockupPreviewSchema,
};
