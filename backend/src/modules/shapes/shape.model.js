const mongoose = require('mongoose');

const { SHAPE_GROUPS } = require('../../constants/shape');

const shapeGeometrySchema = new mongoose.Schema(
  {
    pathCommands: {
      type: String,
      required: true,
      trim: true,
    },
    defaultWidth: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    defaultHeight: {
      type: Number,
      required: true,
      min: 0.0001,
    },
  },
  {
    _id: false,
  },
);

const shapeSourceSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const shapeSchema = new mongoose.Schema(
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
      lowercase: true,
    },
    group: {
      type: String,
      enum: SHAPE_GROUPS,
      default: 'basic',
    },
    tags: {
      type: [String],
      default: () => [],
    },
    geometry: {
      type: shapeGeometrySchema,
      required: true,
    },
    previewUrl: {
      type: String,
      trim: true,
      default: null,
    },
    source: {
      type: shapeSourceSchema,
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
  },
  {
    timestamps: true,
  },
);

shapeSchema.index({ group: 1, isActive: 1, sortOrder: 1 });
shapeSchema.index(
  { 'source.provider': 1, 'source.externalId': 1 },
  {
    unique: true,
    sparse: true,
  },
);

shapeSchema.pre('validate', function normalizeShape(next) {
  if (this.slug) {
    this.slug = String(this.slug).trim().toLowerCase();
  }

  if (this.group) {
    this.group = String(this.group).trim().toLowerCase();
  }

  this.tags = Array.from(
    new Set(
      (Array.isArray(this.tags) ? this.tags : [])
        .map((tag) => String(tag || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  if (!this.previewUrl) {
    this.previewUrl = null;
  }

  if (this.source && (!this.source.provider || !this.source.externalId)) {
    this.source = null;
  }

  if (typeof next === 'function') {
    return next();
  }
});

const Shape = mongoose.model('Shape', shapeSchema);

module.exports = Shape;
