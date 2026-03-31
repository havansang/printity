const fs = require('fs/promises');
const path = require('path');

const mongoose = require('mongoose');

const { connectDB } = require('../src/config/db');
const { debugMockupPreview } = require('../src/modules/mockups/mockup.service');

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}

function sanitizeSegment(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return normalized || 'item';
}

function normalizeGeometry(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') {
    return value || null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeGeometry(entry, seen));
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length}]`;
  }

  if (typeof value.toObject === 'function') {
    return normalizeGeometry(value.toObject(), seen);
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);
  const normalized = {};

  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      normalized[key] = Number(entry.toFixed(2));
      return;
    }

    if (entry && typeof entry === 'object') {
      normalized[key] = normalizeGeometry(entry, seen);
      return;
    }

    normalized[key] = entry ?? null;
  });

  return normalized;
}

async function loadPayload(payloadArg) {
  if (!payloadArg) {
    throw new Error('Missing required --payload <path> argument');
  }

  const payloadPath = path.resolve(process.cwd(), payloadArg);
  const rawPayload = await fs.readFile(payloadPath, 'utf8');
  return JSON.parse(rawPayload);
}

async function writeBuffer(filePath, buffer) {
  if (!buffer) {
    return null;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = await loadPayload(args.payload);
  const outputDir = path.resolve(
    process.cwd(),
    args.out || path.join('tmp', `mockup-debug-${Date.now()}`),
  );

  await connectDB();

  try {
    const result = await debugMockupPreview(payload);
    const summary = {
      templateId: result.templateId,
      colorKey: result.colorKey,
      format: result.format,
      outputDir,
      scenes: [],
    };

    await fs.mkdir(outputDir, { recursive: true });

    for (const preview of result.previews) {
      const sceneDir = path.join(outputDir, sanitizeSegment(preview.sceneKey));
      await fs.mkdir(sceneDir, { recursive: true });

      const previewPath = await writeBuffer(path.join(sceneDir, 'final-preview.png'), preview.buffer);
      const sceneSummary = {
        sceneKey: preview.sceneKey,
        label: preview.label,
        width: preview.width,
        height: preview.height,
        previewPath,
        debugScene: {
          baseAssetUrl: preview.debugScene?.baseAssetUrl || null,
          outputWidth: preview.debugScene?.outputWidth || preview.width,
          outputHeight: preview.debugScene?.outputHeight || preview.height,
          layers: [],
        },
      };

      console.log(`\n[scene] ${preview.sceneKey} (${preview.width}x${preview.height})`);
      console.log(`  preview: ${previewPath}`);

      for (const layer of preview.debugScene?.layers || []) {
        const layerLabel = `${String(layer.index).padStart(2, '0')}-${sanitizeSegment(layer.type)}-${sanitizeSegment(layer.surfaceKey || layer.assetUrl || 'layer')}`;
        const layerDir = path.join(sceneDir, layerLabel);
        await fs.mkdir(layerDir, { recursive: true });

        const stagePaths = {};
        for (const [stageName, stageBuffer] of Object.entries(layer.stageBuffers || {})) {
          const stageFilePath = path.join(layerDir, `${sanitizeSegment(stageName)}.png`);
          stagePaths[stageName] = await writeBuffer(stageFilePath, stageBuffer);
        }

        const normalizedGeometry = normalizeGeometry(layer.geometry || {});
        sceneSummary.debugScene.layers.push({
          index: layer.index,
          type: layer.type,
          surfaceKey: layer.surfaceKey || null,
          assetUrl: layer.assetUrl || null,
          blend: layer.blend || 'over',
          geometry: normalizedGeometry,
          stagePaths,
        });

        console.log(`  [layer ${layer.index}] ${layer.type}${layer.surfaceKey ? `:${layer.surfaceKey}` : ''}`);
        console.log(`    geometry: ${JSON.stringify(normalizedGeometry)}`);
        Object.entries(stagePaths).forEach(([stageName, stagePath]) => {
          console.log(`    ${stageName}: ${stagePath}`);
        });
      }

      summary.scenes.push(sceneSummary);
    }

    const summaryPath = path.join(outputDir, 'summary.json');
    await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    console.log(`\nSummary written to ${summaryPath}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
