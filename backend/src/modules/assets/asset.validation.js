const { objectIdSchema, z } = require('../../utils/validation');

const assetParamsSchema = z.object({
  id: objectIdSchema,
});

module.exports = {
  assetParamsSchema,
};
