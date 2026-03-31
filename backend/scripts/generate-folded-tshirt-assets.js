const fs = require('fs/promises');
const path = require('path');

const sharp = require('sharp');

const MOCKUP_ROOT = path.resolve(__dirname, '..', 'resources', 'mockups', 'basic-tshirt');
const COLORS_ROOT = path.join(MOCKUP_ROOT, 'colors');
const FRONT_ROOT = path.join(MOCKUP_ROOT, 'front');
const FOLDED_ROOT = path.join(MOCKUP_ROOT, 'folded');

const OUTPUT_SIZE = 2048;
const SOURCE_CROP = {
  left: 104,
  top: 104,
  width: 1840,
  height: 1840,
};
const TARGET_QUAD = {
  topLeft: { x: 240, y: 210 },
  topRight: { x: 1660, y: 360 },
  bottomRight: { x: 1510, y: 1970 },
  bottomLeft: { x: 90, y: 1820 },
};

function getQuadBounds(quad) {
  const xs = [quad.topLeft.x, quad.topRight.x, quad.bottomRight.x, quad.bottomLeft.x];
  const ys = [quad.topLeft.y, quad.topRight.y, quad.bottomRight.y, quad.bottomLeft.y];

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  };
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function warpSourceToCanvas(sourcePath, destinationPath, { crop = null, flatten = false } = {}) {
  const sourceBuffer = crop
    ? await sharp(sourcePath).extract(crop).png().toBuffer()
    : await sharp(sourcePath).png().toBuffer();

  const sourceWidth = crop?.width || OUTPUT_SIZE;
  const sourceHeight = crop?.height || OUTPUT_SIZE;
  const bounds = getQuadBounds(TARGET_QUAD);
  const a = (TARGET_QUAD.topRight.x - TARGET_QUAD.topLeft.x) / sourceWidth;
  const b = (TARGET_QUAD.topRight.y - TARGET_QUAD.topLeft.y) / sourceWidth;
  const c = (TARGET_QUAD.bottomLeft.x - TARGET_QUAD.topLeft.x) / sourceHeight;
  const d = (TARGET_QUAD.bottomLeft.y - TARGET_QUAD.topLeft.y) / sourceHeight;
  const warpedBuffer = await sharp(sourceBuffer)
    .ensureAlpha()
    .affine([[a, c], [b, d]], {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      odx: TARGET_QUAD.topLeft.x - bounds.minX,
      ody: TARGET_QUAD.topLeft.y - bounds.minY,
    })
    .png()
    .toBuffer();

  let pipeline = sharp({
    create: {
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: flatten ? 1 : 0 },
    },
  }).composite([
    {
      input: warpedBuffer,
      left: Math.round(bounds.minX),
      top: Math.round(bounds.minY),
    },
  ]);

  if (flatten) {
    pipeline = pipeline.flatten({ background: '#ffffff' });
  }

  await pipeline.png().toFile(destinationPath);
}

async function generateStaticAssets() {
  await ensureDirectory(FOLDED_ROOT);

  await warpSourceToCanvas(path.join(FRONT_ROOT, 'base.png'), path.join(FOLDED_ROOT, 'base.png'), {
    crop: SOURCE_CROP,
    flatten: true,
  });
  await warpSourceToCanvas(path.join(FRONT_ROOT, 'mask.png'), path.join(FOLDED_ROOT, 'mask.png'), {
    crop: SOURCE_CROP,
  });
  await warpSourceToCanvas(path.join(FRONT_ROOT, 'shadow.png'), path.join(FOLDED_ROOT, 'shadow.png'), {
    crop: SOURCE_CROP,
  });
  await warpSourceToCanvas(path.join(FRONT_ROOT, 'highlight.png'), path.join(FOLDED_ROOT, 'highlight.png'), {
    crop: SOURCE_CROP,
  });
  await warpSourceToCanvas(path.join(FRONT_ROOT, 'displacement.png'), path.join(FOLDED_ROOT, 'displacement.png'), {
    crop: SOURCE_CROP,
  });
  await warpSourceToCanvas(path.join(FRONT_ROOT, 'occlusion.svg'), path.join(FOLDED_ROOT, 'occlusion.png'), {
    crop: SOURCE_CROP,
  });
}

async function generateColorBases() {
  const colorEntries = await fs.readdir(COLORS_ROOT, { withFileTypes: true });

  for (const entry of colorEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const frontBasePath = path.join(COLORS_ROOT, entry.name, 'front', 'base.png');

    try {
      await fs.access(frontBasePath);
    } catch {
      continue;
    }

    const foldedDir = path.join(COLORS_ROOT, entry.name, 'folded');
    await ensureDirectory(foldedDir);
    await warpSourceToCanvas(frontBasePath, path.join(foldedDir, 'base.png'), {
      crop: SOURCE_CROP,
      flatten: true,
    });
  }
}

async function run() {
  await generateStaticAssets();
  await generateColorBases();
  console.log('Generated folded T-shirt assets');
}

run().catch((error) => {
  console.error('Failed to generate folded T-shirt assets', error);
  process.exitCode = 1;
});
