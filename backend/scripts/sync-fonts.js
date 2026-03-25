const fs = require('fs/promises');
const path = require('path');

const { FONT_INDEX_PATH, FONT_ROOT, clearFontCaches, normalizeFontStyle, normalizeFontToken, normalizeFontWeight } = require('../src/modules/fonts/font.service');

const FONT_FAMILIES_DIR = path.join(FONT_ROOT, 'families');
const FONT_CATALOG_DIR = path.join(FONT_ROOT, 'catalog');
const DEFAULT_SOURCE_PATH = path.join(FONT_CATALOG_DIR, 'fonts.json');

function slugify(value) {
  return String(value || '')
    .trim()
    .normalize('NFKD')
    .replace(/[^\w\s-]+/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function parseArguments(argv) {
  const options = {
    source: DEFAULT_SOURCE_PATH,
    familyFilters: [],
    force: false,
    limit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === '--source' && argv[index + 1]) {
      options.source = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === '--family' && argv[index + 1]) {
      options.familyFilters.push(
        ...String(argv[index + 1])
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      );
      index += 1;
      continue;
    }

    if (current === '--limit' && argv[index + 1]) {
      const parsedLimit = Number(argv[index + 1]);
      if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
        options.limit = Math.floor(parsedLimit);
      }
      index += 1;
      continue;
    }

    if (current === '--force') {
      options.force = true;
    }
  }

  return options;
}

async function readJsonFromSource(source) {
  if (/^https?:\/\//i.test(String(source))) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to load font catalog from ${source}: ${response.status} ${response.statusText}`);
    }

    const rawText = await response.text();
    return {
      payload: JSON.parse(rawText),
      rawText,
    };
  }

  const absolutePath = path.resolve(process.cwd(), source);
  const rawText = await fs.readFile(absolutePath, 'utf8');
  return {
    payload: JSON.parse(rawText),
    rawText,
  };
}

function resolveFontExtension(contentType, remoteUrl) {
  const normalizedContentType = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (normalizedContentType.includes('woff2')) {
    return 'woff2';
  }

  if (normalizedContentType.includes('woff')) {
    return 'woff';
  }

  if (normalizedContentType.includes('otf') || normalizedContentType.includes('opentype')) {
    return 'otf';
  }

  if (normalizedContentType.includes('ttf') || normalizedContentType.includes('truetype')) {
    return 'ttf';
  }

  const extensionFromUrl = path.extname(new URL(remoteUrl).pathname).replace(/^\./, '').toLowerCase();
  return extensionFromUrl || 'ttf';
}

async function downloadFontVariant({ family, file, force }) {
  const familySlug = slugify(family.family) || normalizeFontToken(family.family);
  const variantSlug =
    slugify(file.fontVariant) ||
    slugify(`${normalizeFontWeight(file.fontWeight)}-${normalizeFontStyle(file.fontStyle)}`) ||
    'regular';
  const familyDir = path.join(FONT_FAMILIES_DIR, familySlug);

  await fs.mkdir(familyDir, { recursive: true });

  const existingFiles = await fs.readdir(familyDir).catch(() => []);
  const existingFileName = existingFiles.find((entry) => entry === `${variantSlug}.part` || entry.startsWith(`${variantSlug}.`));

  if (!force && existingFileName && existingFileName !== `${variantSlug}.part`) {
    const absolutePath = path.join(familyDir, existingFileName);
    return {
      status: 'skipped',
      fontVariant: file.fontVariant || null,
      fontWeight: normalizeFontWeight(file.fontWeight),
      fontStyle: normalizeFontStyle(file.fontStyle),
      label: file.label || null,
      attributes: Array.isArray(file.attributes) ? file.attributes : [],
      remoteUrl: file.url,
      relativePath: path.relative(FONT_ROOT, absolutePath).replace(/\\/g, '/'),
    };
  }

  if (existingFileName === `${variantSlug}.part`) {
    await fs.rm(path.join(familyDir, existingFileName), { force: true });
  }

  const response = await fetch(file.url);
  if (!response.ok) {
    throw new Error(`Failed to download font ${family.family}/${file.fontVariant || file.label || 'variant'}: ${response.status}`);
  }

  const extension = resolveFontExtension(response.headers.get('content-type'), file.url);
  const fileName = `${variantSlug}.${extension}`;
  const absolutePath = path.join(familyDir, fileName);
  const tempPath = `${absolutePath}.part`;

  if (force) {
    await fs.rm(absolutePath, { force: true });
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(tempPath, Buffer.from(arrayBuffer));
  await fs.rename(tempPath, absolutePath);

  return {
    status: 'downloaded',
    fontVariant: file.fontVariant || null,
    fontWeight: normalizeFontWeight(file.fontWeight),
    fontStyle: normalizeFontStyle(file.fontStyle),
    label: file.label || null,
    attributes: Array.isArray(file.attributes) ? file.attributes : [],
    remoteUrl: file.url,
    relativePath: path.relative(FONT_ROOT, absolutePath).replace(/\\/g, '/'),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const { payload, rawText } = await readJsonFromSource(options.source);
  const catalog = Array.isArray(payload) ? payload : [];
  const normalizedFilters = options.familyFilters.map((entry) => normalizeFontToken(entry));
  const filteredCatalog = catalog.filter((familyEntry) => {
    if (normalizedFilters.length === 0) {
      return true;
    }

    return normalizedFilters.includes(normalizeFontToken(familyEntry.family));
  });
  const limitedCatalog = options.limit ? filteredCatalog.slice(0, options.limit) : filteredCatalog;

  if (limitedCatalog.length === 0) {
    console.log('No fonts matched the requested filters.');
    return;
  }

  await fs.mkdir(FONT_ROOT, { recursive: true });
  await fs.mkdir(FONT_CATALOG_DIR, { recursive: true });
  await fs.mkdir(FONT_FAMILIES_DIR, { recursive: true });

  if (rawText) {
    await fs.writeFile(path.join(FONT_CATALOG_DIR, 'fonts.json'), rawText);
  }

  const indexedFonts = [];
  let downloadedVariants = 0;
  let skippedVariants = 0;

  for (const familyEntry of limitedCatalog) {
    const indexedFiles = [];

    for (const file of Array.isArray(familyEntry.files) ? familyEntry.files : []) {
      const downloadedFile = await downloadFontVariant({
        family: familyEntry,
        file,
        force: options.force,
      });
      indexedFiles.push(downloadedFile);
      if (downloadedFile.status === 'skipped') {
        skippedVariants += 1;
        console.log(`Skipped ${familyEntry.family} ${downloadedFile.fontVariant || downloadedFile.label || downloadedFile.fontWeight}`);
      } else {
        downloadedVariants += 1;
        console.log(`Downloaded ${familyEntry.family} ${downloadedFile.fontVariant || downloadedFile.label || downloadedFile.fontWeight}`);
      }
    }

    indexedFonts.push({
      family: familyEntry.family,
      category: familyEntry.category || null,
      coverage: familyEntry.coverage || {},
      attributes: Array.isArray(familyEntry.attributes) ? familyEntry.attributes : [],
      files: indexedFiles,
    });
  }

  await fs.writeFile(
    FONT_INDEX_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: options.source,
        fonts: indexedFonts,
      },
      null,
      2,
    ),
  );

  clearFontCaches();
  console.log(`Synced ${indexedFonts.length} font families into ${FONT_ROOT} (${downloadedVariants} downloaded, ${skippedVariants} skipped)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
