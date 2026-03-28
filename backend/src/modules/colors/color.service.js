const {
  buildAllAvailableColors,
  getAvailableColorsByProductType,
  normalizeProductType,
} = require('../templates/template-color.util');

async function listColors({ productType } = {}) {
  const normalizedProductType = String(productType || '').trim()
    ? normalizeProductType(productType)
    : '';
  const items = normalizedProductType
    ? getAvailableColorsByProductType(normalizedProductType)
    : buildAllAvailableColors();

  return {
    items,
    total: items.length,
  };
}

module.exports = {
  listColors,
};
