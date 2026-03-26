const mongoose = require('mongoose');

const { PRODUCT_TYPES, SURFACE_KEYS } = require('../../constants/product');

const coordinatePointSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  {
    _id: false,
  },
);

const safeZoneSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  {
    _id: false,
  },
);

const bleedSchema = new mongoose.Schema(
  {
    top: { type: Number, default: 0 },
    right: { type: Number, default: 0 },
    bottom: { type: Number, default: 0 },
    left: { type: Number, default: 0 },
  },
  {
    _id: false,
  },
);

const printAreaSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    safeZone: { type: safeZoneSchema, default: null },
    bleed: { type: bleedSchema, default: null },
    anchor: { type: coordinatePointSchema, default: null },
    cornerRadius: { type: Number, default: null },
    unit: { type: String, trim: true, default: 'scene' },
    origin: {
      type: String,
      enum: ['top-left', 'center'],
      default: 'top-left',
    },
  },
  {
    _id: false,
  },
);

const editorSurfaceSchema = new mongoose.Schema(
  {
    sourceType: { type: String, trim: true, default: 'svg' },
    svgUrl: { type: String, trim: true, default: null },
    sceneWidth: { type: Number, default: null },
    sceneHeight: { type: Number, default: null },
    placeholderId: { type: String, trim: true, default: null },
    printArea: { type: printAreaSchema, default: null },
  },
  {
    _id: false,
  },
);

const printQuadSchema = new mongoose.Schema(
  {
    topLeft: { type: coordinatePointSchema, default: null },
    topRight: { type: coordinatePointSchema, default: null },
    bottomRight: { type: coordinatePointSchema, default: null },
    bottomLeft: { type: coordinatePointSchema, default: null },
  },
  {
    _id: false,
  },
);

const renderAssetsSchema = new mongoose.Schema(
  {
    maskImageUrl: { type: String, trim: true, default: null },
    shadowImageUrl: { type: String, trim: true, default: null },
    highlightImageUrl: { type: String, trim: true, default: null },
    displacementImageUrl: { type: String, trim: true, default: null },
    grainImageUrl: { type: String, trim: true, default: null },
    occlusionImageUrl: { type: String, trim: true, default: null },
  },
  {
    _id: false,
  },
);

const blendModesSchema = new mongoose.Schema(
  {
    shadow: { type: String, trim: true, default: 'multiply' },
    highlight: { type: String, trim: true, default: 'screen' },
    grain: { type: String, trim: true, default: 'soft-light' },
  },
  {
    _id: false,
  },
);

const displacementSchema = new mongoose.Schema(
  {
    neutral: { type: Number, default: 128 },
    scaleX: { type: Number, default: 0 },
    scaleY: { type: Number, default: 0 },
    blur: { type: Number, default: 0 },
  },
  {
    _id: false,
  },
);

const renderSurfaceSchema = new mongoose.Schema(
  {
    outputWidth: { type: Number, default: null },
    outputHeight: { type: Number, default: null },
    baseImageUrl: { type: String, trim: true, default: null },
    printArea: { type: printAreaSchema, default: null },
    printQuad: { type: printQuadSchema, default: null },
    assets: { type: renderAssetsSchema, default: () => ({}) },
    blendModes: { type: blendModesSchema, default: () => ({}) },
    displacement: { type: displacementSchema, default: () => ({}) },
  },
  {
    _id: false,
  },
);

const transformPolicySchema = new mongoose.Schema(
  {
    positionUnit: { type: String, trim: true, default: 'normalized' },
    sizeUnit: { type: String, trim: true, default: 'normalized' },
    origin: {
      type: String,
      enum: ['center', 'top-left'],
      default: 'center',
    },
    rotationUnit: { type: String, trim: true, default: 'deg' },
    flipSupported: { type: Boolean, default: true },
    fitMode: {
      type: String,
      enum: ['contain', 'cover', 'stretch'],
      default: 'contain',
    },
    requireSimilarAspectRatio: { type: Boolean, default: true },
    maxAspectRatioDelta: { type: Number, default: 0.01 },
  },
  {
    _id: false,
  },
);

const providerRefsSchema = new mongoose.Schema(
  {
    blueprintId: { type: Number, default: null },
    defaultCameraId: { type: Number, default: null },
    defaultDecoratorId: { type: Number, default: null },
  },
  {
    _id: false,
  },
);

const availableColorSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    hex: { type: String, required: true, trim: true },
    rgb: { type: String, trim: true, default: null },
    imageUrl: { type: String, trim: true, default: null },
    sortOrder: { type: Number, default: 0 },
    isLight: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    providerVariantIds: {
      type: [Number],
      default: () => [],
    },
  },
  {
    _id: false,
  },
);

const mockupPackSchema = new mongoose.Schema(
  {
    slug: { type: String, trim: true, default: null },
    manifestPath: { type: String, trim: true, default: null },
    defaultColorKey: { type: String, trim: true, default: 'white' },
  },
  {
    _id: false,
  },
);

const defaultRenderOptionsSchema = new mongoose.Schema(
  {
    size: { type: Number, default: 2048 },
    format: { type: String, trim: true, default: 'jpeg' },
    mockupMode: { type: String, trim: true, default: 'RGB' },
  },
  {
    _id: false,
  },
);

const surfaceSchema = new mongoose.Schema(
  {
    key: { type: String, enum: SURFACE_KEYS, default: null },
    label: { type: String, required: true, trim: true },
    position: { type: String, trim: true, default: null },
    domId: {
      type: [String],
      default: () => [],
    },
    sequence: { type: Number, default: 0 },
    printable: { type: Boolean, default: true },
    allowedDecorationMethods: {
      type: [String],
      default: () => [],
    },
    templateImageUrl: { type: String, required: true, trim: true },
    overlayImageUrl: { type: String, trim: true, default: null },
    maskImageUrl: { type: String, trim: true, default: null },
    printArea: { type: printAreaSchema, required: true },
    editor: { type: editorSurfaceSchema, default: null },
    transformPolicy: { type: transformPolicySchema, default: () => ({}) },
    render: { type: renderSurfaceSchema, default: () => ({}) },
  },
  {
    _id: false,
  },
);

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    productType: {
      type: String,
      required: true,
      enum: PRODUCT_TYPES,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
    },
    mockupPack: {
      type: mockupPackSchema,
      default: () => ({}),
    },
    providerRefs: {
      type: providerRefsSchema,
      default: () => ({}),
    },
    supportedSurfaces: {
      type: [
        {
          type: String,
          enum: SURFACE_KEYS,
        },
      ],
      default: () => ['front', 'back'],
    },
    surfaces: {
      front: { type: surfaceSchema, required: true },
      back: { type: surfaceSchema, required: true },
      neckLabelInner: { type: surfaceSchema, default: null },
    },
    availableColors: {
      type: [availableColorSchema],
      default: () => [],
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    defaultRenderOptions: {
      type: defaultRenderOptionsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

templateSchema.pre('validate', function normalizeTemplateSurfaces(next) {
  const existingSurfaceKeys = [];

  for (const key of SURFACE_KEYS) {
    const surface = this.surfaces?.[key];

    if (!surface) {
      continue;
    }

    existingSurfaceKeys.push(key);

    if (!surface.key) {
      surface.key = key;
    }

    if (!surface.position) {
      surface.position = key === 'neckLabelInner' ? 'neck' : key;
    }

    if ((!surface.domId || surface.domId.length === 0) && surface.editor?.placeholderId) {
      surface.domId = [`#${surface.editor.placeholderId}`];
    }

    if (!surface.editor) {
      surface.editor = {};
    }

    if (!surface.editor.printArea && surface.printArea) {
      surface.editor.printArea = surface.printArea;
    }

    if (!surface.render) {
      surface.render = {};
    }

    if (!surface.render.assets) {
      surface.render.assets = {};
    }

    if (!surface.render.assets.maskImageUrl && surface.maskImageUrl) {
      surface.render.assets.maskImageUrl = surface.maskImageUrl;
    }
  }

  if (!Array.isArray(this.supportedSurfaces) || this.supportedSurfaces.length === 0) {
    this.supportedSurfaces = existingSurfaceKeys;
  }

  if (typeof next === 'function') {
    return next();
  }
});

const Template = mongoose.model('Template', templateSchema);

module.exports = Template;
