const fs = require('fs');
const path = require('path');

const PRINTIFY_COLORS_CANDIDATE_PATHS = [
  path.resolve(__dirname, '../../../resources/catalog/printify-colors.json'),
  path.resolve(__dirname, '../../../../uploads/printify-colors.json'),
];

function resolvePrintifyColorsPath() {
  const matchedPath = PRINTIFY_COLORS_CANDIDATE_PATHS.find((candidatePath) => fs.existsSync(candidatePath));

  if (!matchedPath) {
    throw new Error(
      `Printify colors file not found. Checked: ${PRINTIFY_COLORS_CANDIDATE_PATHS.join(', ')}`,
    );
  }

  return matchedPath;
}

const PRINTIFY_COLORS_PATH = resolvePrintifyColorsPath();

function readPrintifyColors() {
  return JSON.parse(fs.readFileSync(PRINTIFY_COLORS_PATH, 'utf8').replace(/^\uFEFF/, ''));
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

function buildAvailableColors(colors = readPrintifyColors()) {
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

const PRINTIFY_AVAILABLE_COLORS = buildAvailableColors();

module.exports = {
  PRINTIFY_AVAILABLE_COLORS,
  PRINTIFY_COLORS_PATH,
  buildAvailableColors,
  readPrintifyColors,
  normalizeColorKey,
  normalizeHex,
};
