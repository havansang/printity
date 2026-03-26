const mongoose = require('mongoose');

const { PRODUCT_TYPES, SURFACE_KEYS } = require('../../constants/product');
const { PROJECT_STATUSES } = require('../../constants/project');

const PROJECT_RENDER_STATUSES = ['idle', 'queued', 'processing', 'ready', 'failed'];

function createDefaultSurfaceState() {
  return {
    canvasJson: null,
    previewImageUrl: null,
    designCompositeUrl: null,
    designCompositeWidth: null,
    designCompositeHeight: null,
    renderStatus: 'idle',
    renderHash: null,
  };
}

const selectionSchema = new mongoose.Schema(
  {
    colorKey: {
      type: String,
      trim: true,
      default: null,
    },
    colorLabel: {
      type: String,
      trim: true,
      default: null,
    },
    colorHex: {
      type: String,
      trim: true,
      default: null,
    },
    variantId: {
      type: Number,
      default: null,
    },
    cameraId: {
      type: Number,
      default: null,
    },
    blueprintId: {
      type: Number,
      default: null,
    },
    decoratorId: {
      type: Number,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const renderOptionsSchema = new mongoose.Schema(
  {
    size: {
      type: Number,
      default: null,
    },
    format: {
      type: String,
      trim: true,
      default: null,
    },
    mockupMode: {
      type: String,
      trim: true,
      default: null,
    },
    mirror: {
      type: Boolean,
      default: false,
    },
    printOnSide: {
      type: Boolean,
      default: false,
    },
    canvas: {
      type: Boolean,
      default: false,
    },
    fontColor: {
      type: String,
      trim: true,
      default: null,
    },
    country: {
      type: String,
      trim: true,
      default: null,
    },
    newEmbroideryColorPalette: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
);

const projectSurfaceSchema = new mongoose.Schema(
  {
    canvasJson: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    previewImageUrl: {
      type: String,
      trim: true,
      default: null,
    },
    designCompositeUrl: {
      type: String,
      trim: true,
      default: null,
    },
    designCompositeWidth: {
      type: Number,
      default: null,
    },
    designCompositeHeight: {
      type: Number,
      default: null,
    },
    renderStatus: {
      type: String,
      enum: PROJECT_RENDER_STATUSES,
      default: 'idle',
    },
    renderHash: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      required: true,
    },
    productType: {
      type: String,
      required: true,
      enum: PRODUCT_TYPES,
    },
    selection: {
      type: selectionSchema,
      default: null,
    },
    renderOptions: {
      type: renderOptionsSchema,
      default: null,
    },
    printPayloadRaw: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    printPayloadNormalized: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    surfaces: {
      front: {
        type: projectSurfaceSchema,
        default: createDefaultSurfaceState,
      },
      back: {
        type: projectSurfaceSchema,
        default: createDefaultSurfaceState,
      },
      neckLabelInner: {
        type: projectSurfaceSchema,
        default: createDefaultSurfaceState,
      },
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'draft',
    },
    lastOpenedAt: {
      type: Date,
      default: Date.now,
    },
    lastRenderedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

projectSchema.pre('validate', function ensureProjectSurfaces(next) {
  if (!this.surfaces) {
    this.surfaces = {};
  }

  for (const key of SURFACE_KEYS) {
    if (!this.surfaces[key]) {
      this.surfaces[key] = createDefaultSurfaceState();
    }
  }

  next();
});

projectSchema.index({ userId: 1, updatedAt: -1 });
projectSchema.index({ userId: 1, productType: 1, updatedAt: -1 });
projectSchema.index({ name: 'text' });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
