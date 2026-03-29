const Template = require('./template.model');
const { PRODUCT_AVAILABLE_COLORS } = require('./template-color.util');
const { templateSeedSchema } = require('./template.validation');

const defaultTemplates = [
  {
    name: 'Basic T-shirt',
    slug: 'basic-tshirt',
    productType: 'tshirt',
    description: 'Default front/back t-shirt template for the design editor.',
    version: 1,
    mockupPack: {
      slug: 'basic-tshirt',
      manifestPath: '/mockups/basic-tshirt/manifest.json',
      defaultColorKey: 'white',
    },
    thumbnailUrl: '/mockups/basic-tshirt/thumbnail.svg',
    supportedSurfaces: ['front', 'back', 'neckLabelInner'],
    availableColors: PRODUCT_AVAILABLE_COLORS.tshirt,
    defaultRenderOptions: {
      size: 2048,
      format: 'jpeg',
      mockupMode: 'RGB',
    },
    surfaces: {
      front: {
        key: 'front',
        label: 'Front',
        position: 'front',
        domId: ['#placeholder_front'],
        printable: true,
        allowedDecorationMethods: ['dtg', 'dtf'],
        templateImageUrl: '/mockups/basic-tshirt/front/template.svg',
        printArea: { x: 934.29, y: 784.29, width: 1700, height: 2200 },
        editor: {
          sourceType: 'svg',
          svgUrl: '/mockups/basic-tshirt/front/editor.svg',
          sceneWidth: 3568.58,
          sceneHeight: 3568.58,
          placeholderId: 'placeholder_front',
          printArea: { x: 934.29, y: 784.29, width: 1700, height: 2200 },
        },
        transformPolicy: {
          positionUnit: 'normalized',
          sizeUnit: 'normalized',
          origin: 'center',
          rotationUnit: 'deg',
          fitMode: 'contain',
          requireSimilarAspectRatio: true,
          maxAspectRatioDelta: 0.01,
        },
        render: {
          outputWidth: 2048,
          outputHeight: 2048,
          baseImageUrl: '/mockups/basic-tshirt/front/base.png',
          printArea: { x: 675.5, y: 526, width: 697, height: 902 },
          assets: {
            maskImageUrl: '/mockups/basic-tshirt/front/mask.png',
            shadowImageUrl: '/mockups/basic-tshirt/front/shadow.png',
            highlightImageUrl: '/mockups/basic-tshirt/front/highlight.png',
            grainImageUrl: '/mockups/basic-tshirt/front/grain.svg',
            occlusionImageUrl: '/mockups/basic-tshirt/front/occlusion.svg',
          },
          blendModes: {
            shadow: 'multiply',
            highlight: 'screen',
            grain: 'soft-light',
          },
          displacement: {
            neutral: 128,
            scaleX: 0,
            scaleY: 0,
            blur: 0,
          },
        },
      },
      back: {
        key: 'back',
        label: 'Back',
        position: 'back',
        domId: ['#placeholder_back'],
        printable: true,
        allowedDecorationMethods: ['dtg', 'dtf'],
        templateImageUrl: '/mockups/basic-tshirt/back/template.svg',
        printArea: { x: 1034.29, y: 800, width: 1500, height: 1900 },
        editor: {
          sourceType: 'svg',
          svgUrl: '/mockups/basic-tshirt/back/editor.svg',
          sceneWidth: 3568.58,
          sceneHeight: 3568.58,
          placeholderId: 'placeholder_back',
          printArea: { x: 1034.29, y: 800, width: 1500, height: 1900 },
        },
        transformPolicy: {
          positionUnit: 'normalized',
          sizeUnit: 'normalized',
          origin: 'center',
          rotationUnit: 'deg',
          fitMode: 'contain',
          requireSimilarAspectRatio: true,
          maxAspectRatioDelta: 0.01,
        },
        render: {
          outputWidth: 2048,
          outputHeight: 2048,
          baseImageUrl: '/mockups/basic-tshirt/back/base.svg',
          printArea: { x: 671.5, y: 613, width: 705, height: 893 },
          assets: {
            maskImageUrl: '/mockups/basic-tshirt/back/mask.png',
            shadowImageUrl: '/mockups/basic-tshirt/back/shadow.png',
            highlightImageUrl: '/mockups/basic-tshirt/back/highlight.png',
            displacementImageUrl: '/mockups/basic-tshirt/back/displacement.png',
            grainImageUrl: '/mockups/basic-tshirt/back/grain.svg',
            occlusionImageUrl: '/mockups/basic-tshirt/back/occlusion.svg',
          },
          blendModes: {
            shadow: 'multiply',
            highlight: 'screen',
            grain: 'soft-light',
          },
          displacement: {
            neutral: 128,
            scaleX: 0,
            scaleY: 0,
            blur: 2,
          },
        },
      },
      neckLabelInner: {
        key: 'neckLabelInner',
        label: 'Neck Label Inner',
        position: 'neck',
        domId: ['#placeholder_necktag'],
        printable: true,
        allowedDecorationMethods: ['dtg', 'dtf'],
        templateImageUrl: '/mockups/basic-tshirt/neck-label-inner/template.svg',
        printArea: { x: 211.84, y: 200.9, width: 453.43, height: 453.43 },
        editor: {
          sourceType: 'svg',
          svgUrl: '/mockups/basic-tshirt/neck-label-inner/editor.svg',
          sceneWidth: 877.11,
          sceneHeight: 871.85,
          placeholderId: 'placeholder_necktag',
          printArea: { x: 211.84, y: 200.9, width: 453.43, height: 453.43 },
        },
        transformPolicy: {
          positionUnit: 'normalized',
          sizeUnit: 'normalized',
          origin: 'center',
          rotationUnit: 'deg',
          fitMode: 'contain',
          requireSimilarAspectRatio: true,
          maxAspectRatioDelta: 0.01,
        },
        render: {
          outputWidth: 877.11,
          outputHeight: 871.85,
          baseImageUrl: '/mockups/basic-tshirt/neck-label-inner/base.svg',
          printArea: { x: 211.84, y: 200.9, width: 453.43, height: 453.43 },
          assets: {
            maskImageUrl: '/mockups/basic-tshirt/neck-label-inner/mask.svg',
            shadowImageUrl: '/mockups/basic-tshirt/neck-label-inner/shadow.svg',
            highlightImageUrl: '/mockups/basic-tshirt/neck-label-inner/highlight.svg',
            displacementImageUrl: '/mockups/basic-tshirt/neck-label-inner/displacement.svg',
            grainImageUrl: '/mockups/basic-tshirt/neck-label-inner/grain.svg',
            occlusionImageUrl: '/mockups/basic-tshirt/neck-label-inner/occlusion.svg',
          },
        },
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
    version: 1,
    mockupPack: {
      slug: 'basic-polo',
      manifestPath: '/mockups/basic-polo/manifest.json',
      defaultColorKey: 'white',
    },
    thumbnailUrl: '/mockups/basic-polo/thumbnail.svg',
    supportedSurfaces: ['front', 'back'],
    availableColors: PRODUCT_AVAILABLE_COLORS.polo,
    defaultRenderOptions: {
      size: 2048,
      format: 'jpeg',
      mockupMode: 'RGB',
    },
    surfaces: {
      front: {
        key: 'front',
        label: 'Front',
        position: 'front',
        domId: ['#placeholder_front'],
        printable: true,
        allowedDecorationMethods: ['dtg', 'dtf'],
        templateImageUrl: '/mockups/basic-polo/front/template.svg',
        printArea: { x: 1840, y: 750, width: 400, height: 400 },
        editor: {
          sourceType: 'svg',
          svgUrl: '/mockups/basic-polo/front/editor.svg',
          sceneWidth: 3372.31,
          sceneHeight: 3372.31,
          placeholderId: 'placeholder_front',
          printArea: { x: 1840, y: 750, width: 400, height: 400 },
        },
        transformPolicy: {
          positionUnit: 'normalized',
          sizeUnit: 'normalized',
          origin: 'center',
          rotationUnit: 'deg',
          fitMode: 'contain',
          requireSimilarAspectRatio: true,
          maxAspectRatioDelta: 0.01,
        },
        render: {
          outputWidth: 2048,
          outputHeight: 2048,
          baseImageUrl: '/mockups/basic-polo/front/base.svg',
          printArea: { x: 1107, y: 520, width: 210, height: 210 },
          assets: {
            maskImageUrl: '/mockups/basic-polo/front/mask.png',
            shadowImageUrl: '/mockups/basic-polo/front/shadow.png',
            highlightImageUrl: '/mockups/basic-polo/front/highlight.png',
            displacementImageUrl: '/mockups/basic-polo/front/displacement.png',
            grainImageUrl: '/mockups/basic-polo/front/grain.png',
            occlusionImageUrl: '/mockups/basic-polo/front/occlusion.png',
          },
        },
      },
      back: {
        key: 'back',
        label: 'Back',
        position: 'back',
        domId: ['#placeholder_back'],
        printable: true,
        allowedDecorationMethods: ['dtg', 'dtf'],
        templateImageUrl: '/mockups/basic-polo/back/template.svg',
        printArea: { x: 993.63, y: 620, width: 1400, height: 1600 },
        editor: {
          sourceType: 'svg',
          svgUrl: '/mockups/basic-polo/back/editor.svg',
          sceneWidth: 3372.31,
          sceneHeight: 3372.31,
          placeholderId: 'placeholder_back',
          printArea: { x: 993.63, y: 620, width: 1400, height: 1600 },
        },
        transformPolicy: {
          positionUnit: 'normalized',
          sizeUnit: 'normalized',
          origin: 'center',
          rotationUnit: 'deg',
          fitMode: 'contain',
          requireSimilarAspectRatio: true,
          maxAspectRatioDelta: 0.01,
        },
        render: {
          outputWidth: 2048,
          outputHeight: 2048,
          baseImageUrl: '/mockups/basic-polo/back/base.svg',
          printArea: { x: 635.5, y: 490, width: 777, height: 888 },
          assets: {
            maskImageUrl: '/mockups/basic-polo/back/mask.png',
            shadowImageUrl: '/mockups/basic-polo/back/shadow.png',
            highlightImageUrl: '/mockups/basic-polo/back/highlight.png',
            displacementImageUrl: '/mockups/basic-polo/back/displacement.png',
            grainImageUrl: '/mockups/basic-polo/back/grain.png',
            occlusionImageUrl: '/mockups/basic-polo/back/occlusion.png',
          },
        },
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
