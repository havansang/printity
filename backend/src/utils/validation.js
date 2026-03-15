const { z } = require('zod');

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

const jsonObjectSchema = z.object({}).passthrough();

const booleanQuerySchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return value;
}, z.boolean());

function createPositiveIntegerQuerySchema({ defaultValue, min = 1, max = 100 } = {}) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    const parsedValue = Number(value);
    return Number.isNaN(parsedValue) ? value : parsedValue;
  }, z.number().int().min(min).max(max));
}

function createNullableStringSchema(maxLength = 500) {
  return z.preprocess((value) => {
    if (value === '') {
      return null;
    }

    return value;
  }, z.union([z.string().trim().min(1).max(maxLength), z.null()]));
}

module.exports = {
  z,
  objectIdSchema,
  jsonObjectSchema,
  booleanQuerySchema,
  createPositiveIntegerQuerySchema,
  createNullableStringSchema,
};
