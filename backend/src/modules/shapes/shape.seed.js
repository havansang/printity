const Shape = require('./shape.model');
const { shapeSeedSchema } = require('./shape.validation');

const defaultShapes = require('../../../resources/shapes/default-shapes.json');

async function seedDefaultShapes() {
  const items = [];

  for (const shape of defaultShapes) {
    const parsedShape = shapeSeedSchema.parse(shape);

    await Shape.findOneAndUpdate(
      { slug: parsedShape.slug },
      { $set: parsedShape },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    items.push(parsedShape.slug);
  }

  return {
    count: items.length,
    items,
  };
}

module.exports = {
  defaultShapes,
  seedDefaultShapes,
};
