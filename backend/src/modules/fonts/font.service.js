const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const TextToSVG = require('text-to-svg');

const ApiError = require('../../utils/ApiError');

const FONT_ROOT = path.resolve(process.cwd(), 'resources', 'fonts');
const FONT_INDEX_PATH = path.join(FONT_ROOT, 'index.json');

const textToSvgCache = new Map();
let fontIndexCache = null;
const BACKEND_FONT_FALLBACKS = ['Arial', 'sans-serif', 'serif', 'monospace', 'Times New Roman', 'Courier New'];

function normalizeFontToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeFontStyle(value) {
  const rawValue = String(value || 'normal').trim().toLowerCase();
  return rawValue.includes('italic') || rawValue.includes('oblique') ? 'italic' : 'normal';
}

function normalizeFontWeight(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const rawValue = String(value || '').trim().toLowerCase();
  if (!rawValue) {
    return 400;
  }

  if (rawValue === 'normal' || rawValue === 'regular') {
    return 400;
  }

  if (rawValue === 'bold') {
    return 700;
  }

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : 400;
}

async function loadFontIndex() {
  if (fontIndexCache) {
    return fontIndexCache;
  }

  try {
    const payload = JSON.parse(await fsPromises.readFile(FONT_INDEX_PATH, 'utf8'));
    fontIndexCache = Array.isArray(payload?.fonts) ? payload : { fonts: [] };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    fontIndexCache = { fonts: [] };
  }

  return fontIndexCache;
}

function selectBestVariant(files, requestedWeight, requestedStyle) {
  const normalizedFiles = Array.isArray(files) ? files : [];
  if (normalizedFiles.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestScore = -Infinity;

  for (const file of normalizedFiles) {
    const candidateWeight = normalizeFontWeight(file.fontWeight);
    const candidateStyle = normalizeFontStyle(file.fontStyle);
    let score = 0;

    score -= Math.abs(candidateWeight - requestedWeight);
    score += candidateStyle === requestedStyle ? 2000 : requestedStyle === 'normal' ? 500 : 0;

    if (candidateWeight === requestedWeight) {
      score += 1500;
    }

    if (String(file.fontVariant || '').trim().toLowerCase() === 'regular' && requestedWeight === 400 && requestedStyle === 'normal') {
      score += 250;
    }

    if (score > bestScore) {
      bestMatch = file;
      bestScore = score;
    }
  }

  return bestMatch;
}

function resolveFontPathFromCatalog(fontFamily, fontWeight, fontStyle, indexPayload) {
  const normalizedFamily = normalizeFontToken(fontFamily);
  if (!normalizedFamily) {
    return null;
  }

  const requestedWeight = normalizeFontWeight(fontWeight);
  const requestedStyle = normalizeFontStyle(fontStyle);
  const families = Array.isArray(indexPayload?.fonts) ? indexPayload.fonts : [];
  const familyEntry = families.find((entry) => normalizeFontToken(entry.family) === normalizedFamily);

  if (!familyEntry) {
    return null;
  }

  const bestVariant = selectBestVariant(familyEntry.files, requestedWeight, requestedStyle);
  if (!bestVariant) {
    return null;
  }

  const relativePath = bestVariant.relativePath || bestVariant.localPath || null;
  if (!relativePath) {
    return null;
  }

  const absolutePath = path.resolve(FONT_ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return {
    family: familyEntry.family,
    fontWeight: normalizeFontWeight(bestVariant.fontWeight),
    fontStyle: normalizeFontStyle(bestVariant.fontStyle),
    fontPath: absolutePath,
    source: 'catalog',
  };
}

function getSystemFontCandidates(fontFamily, fontWeight, fontStyle) {
  const normalizedFamily = normalizeFontToken(fontFamily);
  const requestedWeight = normalizeFontWeight(fontWeight);
  const requestedStyle = normalizeFontStyle(fontStyle);
  const isBold = requestedWeight >= 600;
  const isItalic = requestedStyle === 'italic';

  const key =
    normalizedFamily ||
    (isItalic
      ? 'sansserifitalic'
      : isBold
        ? 'sansserifbold'
        : 'sansserif');

  const candidateMap = {
    arial: [
      isBold && isItalic ? 'C:/Windows/Fonts/arialbi.ttf' : null,
      isBold ? 'C:/Windows/Fonts/arialbd.ttf' : null,
      isItalic ? 'C:/Windows/Fonts/ariali.ttf' : null,
      'C:/Windows/Fonts/arial.ttf',
      isBold && isItalic ? '/usr/share/fonts/TTF/LiberationSans-BoldItalic.ttf' : null,
      isBold ? '/usr/share/fonts/TTF/LiberationSans-Bold.ttf' : null,
      isItalic ? '/usr/share/fonts/TTF/LiberationSans-Italic.ttf' : null,
      '/usr/share/fonts/TTF/LiberationSans-Regular.ttf',
      isBold && isItalic ? '/usr/share/fonts/truetype/liberation2/LiberationSans-BoldItalic.ttf' : null,
      isBold ? '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf' : null,
      isItalic ? '/usr/share/fonts/truetype/liberation2/LiberationSans-Italic.ttf' : null,
      '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    ],
    sansserif: [
      isBold && isItalic ? '/usr/share/fonts/TTF/LiberationSans-BoldItalic.ttf' : null,
      isBold ? '/usr/share/fonts/TTF/LiberationSans-Bold.ttf' : null,
      isItalic ? '/usr/share/fonts/TTF/LiberationSans-Italic.ttf' : null,
      '/usr/share/fonts/TTF/LiberationSans-Regular.ttf',
      isBold && isItalic ? '/usr/share/fonts/TTF/DejaVuSans-BoldOblique.ttf' : null,
      isBold ? '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf' : null,
      isItalic ? '/usr/share/fonts/TTF/DejaVuSans-Oblique.ttf' : null,
      '/usr/share/fonts/TTF/DejaVuSans.ttf',
      isBold && isItalic ? 'C:/Windows/Fonts/arialbi.ttf' : null,
      isBold ? 'C:/Windows/Fonts/arialbd.ttf' : null,
      isItalic ? 'C:/Windows/Fonts/ariali.ttf' : null,
      'C:/Windows/Fonts/arial.ttf',
    ],
    serif: [
      isBold && isItalic ? '/usr/share/fonts/TTF/LiberationSerif-BoldItalic.ttf' : null,
      isBold ? '/usr/share/fonts/TTF/LiberationSerif-Bold.ttf' : null,
      isItalic ? '/usr/share/fonts/TTF/LiberationSerif-Italic.ttf' : null,
      '/usr/share/fonts/TTF/LiberationSerif-Regular.ttf',
      isBold && isItalic ? 'C:/Windows/Fonts/timesbi.ttf' : null,
      isBold ? 'C:/Windows/Fonts/timesbd.ttf' : null,
      isItalic ? 'C:/Windows/Fonts/timesi.ttf' : null,
      'C:/Windows/Fonts/times.ttf',
    ],
    monospace: [
      isBold && isItalic ? '/usr/share/fonts/TTF/DejaVuSansMono-BoldOblique.ttf' : null,
      isBold ? '/usr/share/fonts/TTF/DejaVuSansMono-Bold.ttf' : null,
      isItalic ? '/usr/share/fonts/TTF/DejaVuSansMono-Oblique.ttf' : null,
      '/usr/share/fonts/TTF/DejaVuSansMono.ttf',
      isBold && isItalic ? 'C:/Windows/Fonts/courbi.ttf' : null,
      isBold ? 'C:/Windows/Fonts/courbd.ttf' : null,
      isItalic ? 'C:/Windows/Fonts/couri.ttf' : null,
      'C:/Windows/Fonts/cour.ttf',
    ],
    timesnewroman: [
      isBold && isItalic ? 'C:/Windows/Fonts/timesbi.ttf' : null,
      isBold ? 'C:/Windows/Fonts/timesbd.ttf' : null,
      isItalic ? 'C:/Windows/Fonts/timesi.ttf' : null,
      'C:/Windows/Fonts/times.ttf',
    ],
    couriernew: [
      isBold && isItalic ? 'C:/Windows/Fonts/courbi.ttf' : null,
      isBold ? 'C:/Windows/Fonts/courbd.ttf' : null,
      isItalic ? 'C:/Windows/Fonts/couri.ttf' : null,
      'C:/Windows/Fonts/cour.ttf',
    ],
  };

  if (candidateMap[key]) {
    return candidateMap[key].filter(Boolean);
  }

  if (normalizedFamily.includes('serif')) {
    return candidateMap.serif.filter(Boolean);
  }

  if (normalizedFamily.includes('mono')) {
    return candidateMap.monospace.filter(Boolean);
  }

  return candidateMap.sansserif.filter(Boolean);
}

function resolveSystemFontPath(fontFamily, fontWeight, fontStyle) {
  const candidates = getSystemFontCandidates(fontFamily, fontWeight, fontStyle);

  for (const candidatePath of candidates) {
    if (candidatePath && fs.existsSync(candidatePath)) {
      return {
        family: fontFamily || 'sans-serif',
        fontWeight: normalizeFontWeight(fontWeight),
        fontStyle: normalizeFontStyle(fontStyle),
        fontPath: candidatePath,
        source: 'system',
      };
    }
  }

  return null;
}

async function resolveFontVariant(fontOptions = {}) {
  const indexPayload = await loadFontIndex();
  const catalogMatch = resolveFontPathFromCatalog(
    fontOptions.fontFamily,
    fontOptions.fontWeight,
    fontOptions.fontStyle,
    indexPayload,
  );

  if (catalogMatch) {
    return catalogMatch;
  }

  return resolveSystemFontPath(fontOptions.fontFamily, fontOptions.fontWeight, fontOptions.fontStyle);
}

async function getTextToSvg(fontOptions = {}) {
  const resolvedFont = await resolveFontVariant(fontOptions);
  if (!resolvedFont?.fontPath) {
    return null;
  }

  if (!textToSvgCache.has(resolvedFont.fontPath)) {
    textToSvgCache.set(resolvedFont.fontPath, TextToSVG.loadSync(resolvedFont.fontPath));
  }

  return {
    ...resolvedFont,
    textToSVG: textToSvgCache.get(resolvedFont.fontPath),
  };
}

function clearFontCaches() {
  fontIndexCache = null;
  textToSvgCache.clear();
}

function shouldIncludeVariantsFlag(includeVariants = true) {
  return includeVariants === false || String(includeVariants).trim().toLowerCase() === 'false' ? false : true;
}

function mapFontEntry(entry, shouldIncludeVariants) {
  const variants = (Array.isArray(entry.files) ? entry.files : []).map((file) => ({
    fontVariant: file.fontVariant || null,
    fontWeight: normalizeFontWeight(file.fontWeight),
    fontStyle: normalizeFontStyle(file.fontStyle),
    label: file.label || null,
    attributes: Array.isArray(file.attributes) ? file.attributes : [],
    relativePath: file.relativePath || file.localPath || null,
    remoteUrl: file.remoteUrl || null,
  }));

  return {
    family: entry.family,
    category: entry.category || null,
    coverage: entry.coverage || {},
    attributes: Array.isArray(entry.attributes) ? entry.attributes : [],
    source: 'catalog',
    variantCount: variants.length,
    variants: shouldIncludeVariants ? variants : undefined,
  };
}

async function listBackendFonts({ search, includeVariants = true } = {}) {
  const indexPayload = await loadFontIndex();
  const normalizedSearch = normalizeFontToken(search);
  const shouldIncludeVariants = shouldIncludeVariantsFlag(includeVariants);
  const families = Array.isArray(indexPayload?.fonts) ? indexPayload.fonts : [];
  const items = families
    .filter((entry) => {
      if (!normalizedSearch) {
        return true;
      }

      return normalizeFontToken(entry.family).includes(normalizedSearch);
    })
    .sort((left, right) => String(left.family).localeCompare(String(right.family)))
    .map((entry) => mapFontEntry(entry, shouldIncludeVariants));

  return {
    items,
    total: items.length,
    fallbackFamilies: [...BACKEND_FONT_FALLBACKS],
    generatedAt: indexPayload?.generatedAt || null,
    source: indexPayload?.source || null,
  };
}

async function getBackendFontByFamily({ family, includeVariants = true } = {}) {
  const indexPayload = await loadFontIndex();
  const normalizedFamily = normalizeFontToken(family);
  const shouldIncludeVariants = shouldIncludeVariantsFlag(includeVariants);
  const families = Array.isArray(indexPayload?.fonts) ? indexPayload.fonts : [];
  const familyEntry = families.find((entry) => normalizeFontToken(entry.family) === normalizedFamily);

  if (familyEntry) {
    return {
      font: mapFontEntry(familyEntry, shouldIncludeVariants),
      fallbackFamilies: [...BACKEND_FONT_FALLBACKS],
      generatedAt: indexPayload?.generatedAt || null,
      source: indexPayload?.source || null,
    };
  }

  const fallbackFamily = BACKEND_FONT_FALLBACKS.find((entry) => normalizeFontToken(entry) === normalizedFamily);
  if (fallbackFamily) {
    return {
      font: {
        family: fallbackFamily,
        category: null,
        coverage: {},
        attributes: [],
        source: 'system',
        variantCount: 0,
        variants: shouldIncludeVariants ? [] : undefined,
      },
      fallbackFamilies: [...BACKEND_FONT_FALLBACKS],
      generatedAt: indexPayload?.generatedAt || null,
      source: indexPayload?.source || null,
    };
  }

  throw new ApiError(404, 'Font not found');
}

module.exports = {
  BACKEND_FONT_FALLBACKS,
  FONT_ROOT,
  FONT_INDEX_PATH,
  clearFontCaches,
  getBackendFontByFamily,
  getTextToSvg,
  loadFontIndex,
  listBackendFonts,
  normalizeFontStyle,
  normalizeFontToken,
  normalizeFontWeight,
  resolveFontVariant,
};
