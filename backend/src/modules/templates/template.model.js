const mongoose = require('mongoose');

const { PRODUCT_TYPES } = require('../../constants/product');

const printAreaSchema = new mongoose.Schema(
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

const surfaceSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    templateImageUrl: { type: String, required: true, trim: true },
    overlayImageUrl: { type: String, trim: true, default: null },
    maskImageUrl: { type: String, trim: true, default: null },
    printArea: { type: printAreaSchema, required: true },
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
    surfaces: {
      front: { type: surfaceSchema, required: true },
      back: { type: surfaceSchema, required: true },
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
  },
  {
    timestamps: true,
  },
);

const Template = mongoose.model('Template', templateSchema);

module.exports = Template;
