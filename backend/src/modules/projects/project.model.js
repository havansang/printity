const mongoose = require('mongoose');

const { PRODUCT_TYPES } = require('../../constants/product');
const { PROJECT_STATUSES } = require('../../constants/project');

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
    surfaces: {
      front: {
        type: projectSurfaceSchema,
        default: () => ({ canvasJson: null, previewImageUrl: null }),
      },
      back: {
        type: projectSurfaceSchema,
        default: () => ({ canvasJson: null, previewImageUrl: null }),
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
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ userId: 1, updatedAt: -1 });
projectSchema.index({ userId: 1, productType: 1, updatedAt: -1 });
projectSchema.index({ name: 'text' });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
