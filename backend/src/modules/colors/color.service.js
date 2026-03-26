const { buildAvailableColors } = require('../templates/template-color.util');

async function listColors() {
  const items = buildAvailableColors();

  return {
    items,
    total: items.length,
  };
}

module.exports = {
  listColors,
};
