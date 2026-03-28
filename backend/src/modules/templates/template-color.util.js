const fs = require('fs');
const path = require('path');
const { PRODUCT_TYPES } = require('../../constants/product');

const PRODUCT_COLOR_CANDIDATE_PATHS = {
  tshirt: [
    path.resolve(__dirname, '../../../resources/catalog/printify-colors.json'),
    path.resolve(__dirname, '../../../../uploads/printify-colors.json'),
  ],
  polo: [
    path.resolve(__dirname, '../../../resources/catalog/printify-polo-colors.json'),
    path.resolve(__dirname, '../../../../uploads/printify-polo-colors.json'),
  ],
};

function normalizeProductType(productType) {
  const normalizedValue = String(productType || '')
    .trim()
    .toLowerCase();

  if (PRODUCT_TYPES.includes(normalizedValue)) {
    return normalizedValue;
  }

  return 'tshirt';
}

function resolvePrintifyColorsPath(productType = 'tshirt') {
  const normalizedProductType = normalizeProductType(productType);
  const candidatePaths = PRODUCT_COLOR_CANDIDATE_PATHS[normalizedProductType] || [];
  const matchedPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));

  if (!matchedPath) {
    throw new Error(
      `Printify colors file not found for "${normalizedProductType}". Checked: ${candidatePaths.join(', ')}`,
    );
  }

  return matchedPath;
}

function readPrintifyColors(productType = 'tshirt') {
  const colorsPath = resolvePrintifyColorsPath(productType);
  return JSON.parse(fs.readFileSync(colorsPath, 'utf8').replace(/^\uFEFF/, ''));
}

function normalizeHex(hex) {
  const value = String(hex || '').trim().toUpperCase();
  if (!value) {
    return null;
  }

  return value.startsWith('#') ? value : `#${value}`;
}

function normalizeColorKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function parseRgbTriplet(rgbValue) {
  const match = String(rgbValue || '')
    .trim()
    .match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);

  if (!match) {
    return null;
  }

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
}

function getRelativeLuminance({ r, g, b }) {
  const convertChannel = (channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const red = convertChannel(r);
  const green = convertChannel(g);
  const blue = convertChannel(b);

  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function mapPrintifyColor(color, index) {
  const label = String(color?.label || '').trim();
  const key = normalizeColorKey(label);
  const hex = normalizeHex(color?.hex);
  const rgb = String(color?.rgb || '').trim() || null;
  const parsedRgb = parseRgbTriplet(rgb);

  return {
    key,
    label,
    hex,
    rgb,
    imageUrl: String(color?.imageUrl || '').trim() || null,
    sortOrder: index + 1,
    isLight: parsedRgb ? getRelativeLuminance(parsedRgb) >= 0.45 : false,
    isActive: true,
    providerVariantIds: [],
  };
}

function buildAvailableColors(input = 'tshirt') {
  const colors = Array.isArray(input) ? input : readPrintifyColors(input);
  const deduped = new Map();

  colors.forEach((color, index) => {
    const mapped = mapPrintifyColor(color, index);
    if (!mapped.key || !mapped.label || !mapped.hex) {
      return;
    }

    if (!deduped.has(mapped.key)) {
      deduped.set(mapped.key, mapped);
    }
  });

  return Array.from(deduped.values());
}

function getAvailableColorsByProductType(productType = 'tshirt') {
  const normalizedProductType = normalizeProductType(productType);
  return PRODUCT_AVAILABLE_COLORS[normalizedProductType] || [];
}

function buildAllAvailableColors() {
  return buildAvailableColors(
    PRODUCT_TYPES.flatMap((productType) => getAvailableColorsByProductType(productType))
  );
}

const PRODUCT_AVAILABLE_COLORS = Object.freeze(
  Object.fromEntries(
    PRODUCT_TYPES.map((productType) => [productType, buildAvailableColors(productType)])
  )
);
const PRINTIFY_AVAILABLE_COLORS = PRODUCT_AVAILABLE_COLORS.tshirt;
const PRINTIFY_COLORS_PATH = resolvePrintifyColorsPath('tshirt');

module.exports = {
  PRODUCT_AVAILABLE_COLORS,
  PRODUCT_COLOR_CANDIDATE_PATHS,
  PRINTIFY_AVAILABLE_COLORS,
  PRINTIFY_COLORS_PATH,
  buildAllAvailableColors,
  buildAvailableColors,
  getAvailableColorsByProductType,
  normalizeProductType,
  readPrintifyColors,
  normalizeColorKey,
  normalizeHex,
};
