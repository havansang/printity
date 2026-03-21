const Template = require('./template.model');
const { templateSeedSchema } = require('./template.validation');

const defaultTemplates = [
  {
    name: 'Basic T-shirt',
    slug: 'basic-tshirt',
    productType: 'tshirt',
    description: 'Default front/back t-shirt template for the design editor.',
    thumbnailUrl: '/uploads/templates/basic-tshirt-thumb.png',
    surfaces: {
      front: {
        label: 'Front',
        templateImageUrl: '/uploads/templates/basic-tshirt-front.png',
        printArea: { x: 120, y: 140, width: 260, height: 320 },
      },
      back: {
        label: 'Back',
        templateImageUrl: '/uploads/templates/basic-tshirt-back.png',
        printArea: { x: 120, y: 140, width: 260, height: 320 },
      },
    },
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Basic Polo',
    slug: 'basic-polo',
    productType: 'polo',
    description: 'Default front/back polo template for the design editor.',
    thumbnailUrl: '/uploads/templates/basic-polo-thumb.png',
    surfaces: {
      front: {
        label: 'Front',
        templateImageUrl: '/uploads/templates/basic-polo-front.png',
        printArea: { x: 130, y: 150, width: 240, height: 300 },
      },
      back: {
        label: 'Back',
        templateImageUrl: '/uploads/templates/basic-polo-back.png',
        printArea: { x: 130, y: 150, width: 240, height: 300 },
      },
    },
    isActive: true,
    sortOrder: 2,
  },
];

async function seedDefaultTemplates() {
  const items = [];

  for (const template of defaultTemplates) {
    const parsedTemplate = templateSeedSchema.parse(template);

    await Template.findOneAndUpdate(
      { slug: parsedTemplate.slug },
      { $set: parsedTemplate },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    items.push(parsedTemplate.slug);
  }

  return {
    count: items.length,
    items,
  };
}

module.exports = {
  defaultTemplates,
  seedDefaultTemplates,
};
