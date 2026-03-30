const fs = require('fs/promises');
const path = require('path');

const sharp = require('sharp');

const ApiError = require('../../utils/ApiError');
const { SURFACE_KEYS } = require('../../constants/product');
const { getUploadRootAbsolutePath } = require('../../utils/file');
const Asset = require('../assets/asset.model');
const { getTextToSvg } = require('../fonts/font.service');
const shapeService = require('../shapes/shape.service');
const { normalizeColorKey, normalizeHex } = require('../templates/template-color.util');
const { getActiveTemplateById } = require('../templates/template.service');

const MOCKUP_ROOT = path.resolve(process.cwd(), 'resources', 'mockups');
const LOCAL_ASSET_CACHE = new Map();
const LOCAL_MANIFEST_CACHE = new Map();
const ASSET_RECORD_CACHE = new Map();
const SHAPE_RECORD_CACHE = new Map();
const FORMAT_ALIASES = {
  jpg: 'jpeg',
};
const DEFAULT_DEBUG_STAGE_KEYS = ['base', 'design', 'masked', 'warped', 'shadowed', 'final'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundDimension(value, fallback = 1) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return Math.max(1, Math.round(numericValue));
}

function scalePrintArea(printArea, scale) {
  return {
    x: Number(printArea.x) * scale,
    y: Number(printArea.y) * scale,
    width: Number(printArea.width) * scale,
    height: Number(printArea.height) * scale,
  };
}

function normalizePoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

function normalizePrintQuad(printQuad) {
  return {
    topLeft: normalizePoint(printQuad?.topLeft),
    topRight: normalizePoint(printQuad?.topRight),
    bottomRight: normalizePoint(printQuad?.bottomRight),
    bottomLeft: normalizePoint(printQuad?.bottomLeft),
  };
}

function scalePrintQuad(printQuad, scale) {
  const normalizedPrintQuad = normalizePrintQuad(printQuad);

  return {
    topLeft: {
      x: normalizedPrintQuad.topLeft.x * scale,
      y: normalizedPrintQuad.topLeft.y * scale,
    },
    topRight: {
      x: normalizedPrintQuad.topRight.x * scale,
      y: normalizedPrintQuad.topRight.y * scale,
    },
    bottomRight: {
      x: normalizedPrintQuad.bottomRight.x * scale,
      y: normalizedPrintQuad.bottomRight.y * scale,
    },
    bottomLeft: {
      x: normalizedPrintQuad.bottomLeft.x * scale,
      y: normalizedPrintQuad.bottomLeft.y * scale,
    },
  };
}

function getPrintQuadBounds(printQuad) {
  const normalizedPrintQuad = normalizePrintQuad(printQuad);
  const xs = [
    normalizedPrintQuad.topLeft.x,
    normalizedPrintQuad.topRight.x,
    normalizedPrintQuad.bottomRight.x,
    normalizedPrintQuad.bottomLeft.x,
  ];
  const ys = [
    normalizedPrintQuad.topLeft.y,
    normalizedPrintQuad.topRight.y,
    normalizedPrintQuad.bottomRight.y,
    normalizedPrintQuad.bottomLeft.y,
  ];

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function fitsPrintQuadWithinBounds(printQuad, width, height, tolerance = 1) {
  if (!printQuad) {
    return false;
  }

  const normalizedPrintQuad = normalizePrintQuad(printQuad);
  const points = [
    normalizedPrintQuad.topLeft,
    normalizedPrintQuad.topRight,
    normalizedPrintQuad.bottomRight,
    normalizedPrintQuad.bottomLeft,
  ];

  return points.every((point) => (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= -tolerance &&
    point.y >= -tolerance &&
    point.x <= Number(width) + tolerance &&
    point.y <= Number(height) + tolerance
  ));
}

function fitsWithinBounds(printArea, width, height, tolerance = 1) {
  if (!printArea) {
    return false;
  }

  const x = Number(printArea.x);
  const y = Number(printArea.y);
  const rectWidth = Number(printArea.width);
  const rectHeight = Number(printArea.height);

  if (![x, y, rectWidth, rectHeight].every(Number.isFinite) || rectWidth <= 0 || rectHeight <= 0) {
    return false;
  }

  return (
    x >= -tolerance &&
    y >= -tolerance &&
    x + rectWidth <= Number(width) + tolerance &&
    y + rectHeight <= Number(height) + tolerance
  );
}

function normalizeRect(printArea) {
  return {
    x: Number(printArea?.x) || 0,
    y: Number(printArea?.y) || 0,
    width: Number(printArea?.width) || 0,
    height: Number(printArea?.height) || 0,
  };
}

function normalizeSourceCrop(sourceCrop) {
  return {
    x: Number(sourceCrop?.x) || 0,
    y: Number(sourceCrop?.y) || 0,
    width: Number(sourceCrop?.width) || 0,
    height: Number(sourceCrop?.height) || 0,
  };
}

function toPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (typeof value.toObject === 'function') {
    return value.toObject({
      depopulate: true,
      versionKey: false,
    });
  }

  return value;
}

function buildPrintQuadFromRotatedRect(printArea, rotationDeg = 0) {
  const normalizedRect = normalizeRect(printArea);
  const angleInRadians = (Number(rotationDeg) || 0) * (Math.PI / 180);

  if (!angleInRadians) {
    return null;
  }

  const halfWidth = normalizedRect.width / 2;
  const halfHeight = normalizedRect.height / 2;
  const cosine = Math.cos(angleInRadians);
  const sine = Math.sin(angleInRadians);
  const boundsWidth = (Math.abs(normalizedRect.width * cosine) + Math.abs(normalizedRect.height * sine));
  const boundsHeight = (Math.abs(normalizedRect.width * sine) + Math.abs(normalizedRect.height * cosine));
  // rotationDeg uses printArea.x/y as the top-left of the rotated bounds in scene space.
  const centerX = normalizedRect.x + (boundsWidth / 2);
  const centerY = normalizedRect.y + (boundsHeight / 2);
  const rotatePoint = (dx, dy) => ({
    x: centerX + ((dx * cosine) - (dy * sine)),
    y: centerY + ((dx * sine) + (dy * cosine)),
  });

  return {
    topLeft: rotatePoint(-halfWidth, -halfHeight),
    topRight: rotatePoint(halfWidth, -halfHeight),
    bottomRight: rotatePoint(halfWidth, halfHeight),
    bottomLeft: rotatePoint(-halfWidth, halfHeight),
  };
}

function resolveRenderPrintAreaSpace({
  printArea,
  configuredWidth,
  configuredHeight,
  actualWidth,
  actualHeight,
  forceScale = false,
}) {
  const normalizedPrintArea = normalizeRect(printArea);

  if (!forceScale && fitsWithinBounds(normalizedPrintArea, actualWidth, actualHeight)) {
    return normalizedPrintArea;
  }

  if (
    Number.isFinite(Number(configuredWidth)) &&
    Number.isFinite(Number(configuredHeight)) &&
    Number(configuredWidth) > 0 &&
    Number(configuredHeight) > 0
  ) {
    return {
      x: (normalizedPrintArea.x / Number(configuredWidth)) * Number(actualWidth),
      y: (normalizedPrintArea.y / Number(configuredHeight)) * Number(actualHeight),
      width: (normalizedPrintArea.width / Number(configuredWidth)) * Number(actualWidth),
      height: (normalizedPrintArea.height / Number(configuredHeight)) * Number(actualHeight),
    };
  }

  return normalizedPrintArea;
}

function resolveRenderPrintQuadSpace({
  printQuad,
  configuredWidth,
  configuredHeight,
  actualWidth,
  actualHeight,
  forceScale = false,
}) {
  const normalizedPrintQuad = normalizePrintQuad(printQuad);

  if (!forceScale && fitsPrintQuadWithinBounds(normalizedPrintQuad, actualWidth, actualHeight)) {
    return normalizedPrintQuad;
  }

  if (
    Number.isFinite(Number(configuredWidth)) &&
    Number.isFinite(Number(configuredHeight)) &&
    Number(configuredWidth) > 0 &&
    Number(configuredHeight) > 0
  ) {
    return {
      topLeft: {
        x: (normalizedPrintQuad.topLeft.x / Number(configuredWidth)) * Number(actualWidth),
        y: (normalizedPrintQuad.topLeft.y / Number(configuredHeight)) * Number(actualHeight),
      },
      topRight: {
        x: (normalizedPrintQuad.topRight.x / Number(configuredWidth)) * Number(actualWidth),
        y: (normalizedPrintQuad.topRight.y / Number(configuredHeight)) * Number(actualHeight),
      },
      bottomRight: {
        x: (normalizedPrintQuad.bottomRight.x / Number(configuredWidth)) * Number(actualWidth),
        y: (normalizedPrintQuad.bottomRight.y / Number(configuredHeight)) * Number(actualHeight),
      },
      bottomLeft: {
        x: (normalizedPrintQuad.bottomLeft.x / Number(configuredWidth)) * Number(actualWidth),
        y: (normalizedPrintQuad.bottomLeft.y / Number(configuredHeight)) * Number(actualHeight),
      },
    };
  }

  return normalizedPrintQuad;
}

function resolveSourceCropInEditorSpace(sourceCrop, editorWidth, editorHeight) {
  if (!sourceCrop) {
    return null;
  }

  const normalizedSourceCrop = normalizeSourceCrop(sourceCrop);
  const cropLooksNormalized = [
    normalizedSourceCrop.x,
    normalizedSourceCrop.y,
    normalizedSourceCrop.width,
    normalizedSourceCrop.height,
  ].every((value) => Number.isFinite(value) && value >= 0 && value <= 1);

  const rawCropRect = cropLooksNormalized
    ? {
        x: normalizedSourceCrop.x * editorWidth,
        y: normalizedSourceCrop.y * editorHeight,
        width: normalizedSourceCrop.width * editorWidth,
        height: normalizedSourceCrop.height * editorHeight,
      }
    : normalizedSourceCrop;

  const left = clamp(Math.floor(rawCropRect.x), 0, Math.max(0, roundDimension(editorWidth) - 1));
  const top = clamp(Math.floor(rawCropRect.y), 0, Math.max(0, roundDimension(editorHeight) - 1));
  const right = clamp(
    Math.ceil(rawCropRect.x + rawCropRect.width),
    left + 1,
    roundDimension(editorWidth),
  );
  const bottom = clamp(
    Math.ceil(rawCropRect.y + rawCropRect.height),
    top + 1,
    roundDimension(editorHeight),
  );

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function normalizeFormat(format) {
  const rawValue = String(format || 'png').trim().toLowerCase();
  return FORMAT_ALIASES[rawValue] || rawValue;
}

function getMimeTypeForFormat(format) {
  switch (normalizeFormat(format)) {
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'png':
    default:
      return 'image/png';
  }
}

function getMimeTypeFromFilePath(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.svg':
      return 'image/svg+xml';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.png':
    default:
      return 'image/png';
  }
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function formatDebugNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '0';
  }

  if (Math.abs(numericValue - Math.round(numericValue)) < 0.01) {
    return String(Math.round(numericValue));
  }

  return numericValue.toFixed(2);
}

function buildDebugOverlaySvg({
  width,
  height,
  rects = [],
  quads = [],
}) {
  const elements = [];

  rects.forEach((rect, index) => {
    if (!rect || Number(rect.width) <= 0 || Number(rect.height) <= 0) {
      return;
    }

    const stroke = rect.stroke || '#ff006e';
    const fill = rect.fill || `${stroke}1a`;
    const labelX = Number(rect.x) + 6;
    const labelY = Math.max(18, Number(rect.y) - 8);
    const label = rect.label
      ? `${rect.label} (${formatDebugNumber(rect.x)}, ${formatDebugNumber(rect.y)}, ${formatDebugNumber(rect.width)}x${formatDebugNumber(rect.height)})`
      : null;

    elements.push(`
      <rect
        x="${formatDebugNumber(rect.x)}"
        y="${formatDebugNumber(rect.y)}"
        width="${formatDebugNumber(rect.width)}"
        height="${formatDebugNumber(rect.height)}"
        fill="${escapeXml(fill)}"
        stroke="${escapeXml(stroke)}"
        stroke-width="4"
        vector-effect="non-scaling-stroke"
      />
    `);

    if (label) {
      elements.push(`
        <g>
          <rect
            x="${formatDebugNumber(labelX - 4)}"
            y="${formatDebugNumber(labelY - 14)}"
            width="${Math.max(180, label.length * 8)}"
            height="22"
            fill="rgba(0,0,0,0.72)"
            rx="4"
          />
          <text
            x="${formatDebugNumber(labelX)}"
            y="${formatDebugNumber(labelY)}"
            fill="${escapeXml(stroke)}"
            font-family="Arial, sans-serif"
            font-size="16"
            font-weight="700"
          >${escapeXml(label)}</text>
        </g>
      `);
    }

    elements.push(`
      <circle
        cx="${formatDebugNumber(rect.x)}"
        cy="${formatDebugNumber(rect.y)}"
        r="6"
        fill="${escapeXml(stroke)}"
      />
    `);

    if (index === 0) {
      elements.push(`
        <text
          x="16"
          y="${height - 20}"
          fill="#111111"
          font-family="Arial, sans-serif"
          font-size="15"
          font-weight="700"
        >Rect stroke marks placement bounds. Filled tint marks coverage.</text>
      `);
    }
  });

  quads.forEach((quad) => {
    if (!quad) {
      return;
    }

    const points = [
      quad.topLeft,
      quad.topRight,
      quad.bottomRight,
      quad.bottomLeft,
    ]
      .map((point) => `${formatDebugNumber(point?.x)} ${formatDebugNumber(point?.y)}`)
      .join(' ');
    const stroke = quad.stroke || '#ffbe0b';
    const fill = quad.fill || `${stroke}26`;
    const label = quad.label || null;

    elements.push(`
      <polygon
        points="${points}"
        fill="${escapeXml(fill)}"
        stroke="${escapeXml(stroke)}"
        stroke-width="4"
        vector-effect="non-scaling-stroke"
      />
    `);

    ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'].forEach((cornerKey) => {
      const point = quad[cornerKey];
      if (!point) {
        return;
      }

      elements.push(`
        <circle
          cx="${formatDebugNumber(point.x)}"
          cy="${formatDebugNumber(point.y)}"
          r="6"
          fill="${escapeXml(stroke)}"
        />
      `);
    });

    if (label && quad.topLeft) {
      elements.push(`
        <g>
          <rect
            x="${formatDebugNumber(Number(quad.topLeft.x) + 8)}"
            y="${formatDebugNumber(Number(quad.topLeft.y) - 22)}"
            width="${Math.max(160, label.length * 8)}"
            height="22"
            fill="rgba(0,0,0,0.72)"
            rx="4"
          />
          <text
            x="${formatDebugNumber(Number(quad.topLeft.x) + 12)}"
            y="${formatDebugNumber(Number(quad.topLeft.y) - 7)}"
            fill="${escapeXml(stroke)}"
            font-family="Arial, sans-serif"
            font-size="16"
            font-weight="700"
          >${escapeXml(label)}</text>
        </g>
      `);
    }
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      ${elements.join('\n')}
    </svg>
  `;
}

async function createDebugOverlayBuffer({
  width,
  height,
  rects = [],
  quads = [],
}) {
  if (rects.length === 0 && quads.length === 0) {
    return createTransparentCanvas(width, height);
  }

  return rasterizeSvgToPng(
    buildDebugOverlaySvg({
      width,
      height,
      rects,
      quads,
    }),
    width,
    height,
  );
}

async function annotateBufferWithDebugOverlay(buffer, {
  width,
  height,
  rects = [],
  quads = [],
}) {
  const overlay = await createDebugOverlayBuffer({
    width,
    height,
    rects,
    quads,
  });

  return sharp(buffer)
    .composite([{ input: overlay, blend: 'over' }])
    .png()
    .toBuffer();
}

function normalizeDebugStageKeys(debugStages) {
  const requestedStageKeys = Array.isArray(debugStages) ? debugStages : [];

  if (requestedStageKeys.length === 0) {
    return [...DEFAULT_DEBUG_STAGE_KEYS];
  }

  return DEFAULT_DEBUG_STAGE_KEYS.filter((stageKey) => requestedStageKeys.includes(stageKey));
}

function createTransparentCanvas(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
}

function createTemplateSurfaceMap(template) {
  return Object.fromEntries(
    SURFACE_KEYS.map((key) => [key, template.surfaces?.[key]]).filter(([, value]) => Boolean(value)),
  );
}

function mapPlaceholderToSurfaceKey(template, placeholder) {
  const surfaces = createTemplateSurfaceMap(template);
  const domIds = Array.isArray(placeholder?.dom_id) ? placeholder.dom_id : [];
  const position = String(placeholder?.position || '').trim().toLowerCase();

  for (const [surfaceKey, surface] of Object.entries(surfaces)) {
    const surfaceDomIds = Array.isArray(surface.domId) ? surface.domId : [];
    if (domIds.some((domId) => surfaceDomIds.includes(domId))) {
      return surfaceKey;
    }

    const surfacePosition = String(surface.position || (surfaceKey === 'neckLabelInner' ? 'neck' : surfaceKey)).trim().toLowerCase();
    if (position && position === surfacePosition) {
      return surfaceKey;
    }
  }

  if (position === 'neck') {
    return template.surfaces?.neckLabelInner ? 'neckLabelInner' : null;
  }

  return position && SURFACE_KEYS.includes(position) && template.surfaces?.[position] ? position : null;
}

function collectSurfacePayloads(template, printPayload) {
  const placeholders = Array.isArray(printPayload?.placeholders) ? printPayload.placeholders : [];
  const bySurface = new Map();

  for (const placeholder of placeholders) {
    if (placeholder?.printable === false) {
      continue;
    }

    const surfaceKey = mapPlaceholderToSurfaceKey(template, placeholder);
    if (!surfaceKey) {
      continue;
    }

    const current = bySurface.get(surfaceKey) || {
      surfaceKey,
      position: placeholder.position || null,
      domId: placeholder.dom_id || [],
      decorationMethod: placeholder.decoration_method || null,
      images: [],
    };

    current.images.push(...(Array.isArray(placeholder.images) ? placeholder.images : []));
    bySurface.set(surfaceKey, current);
  }

  return bySurface;
}

function resolveRequestedSurfaceKeys(template, printPayload, requestedSurfaceKey) {
  const matchedSurfacePayloads = collectSurfacePayloads(template, printPayload);

  if (requestedSurfaceKey) {
    return [requestedSurfaceKey];
  }

  if (matchedSurfacePayloads.size > 0) {
    return (template.supportedSurfaces || SURFACE_KEYS).filter((surfaceKey) => matchedSurfacePayloads.has(surfaceKey));
  }

  return (template.supportedSurfaces || SURFACE_KEYS).filter((surfaceKey) => Boolean(template.surfaces?.[surfaceKey]));
}

function collectSurfacePayloadsFromPayload(template, payload) {
  const bySurface = collectSurfacePayloads(template, payload?.print);
  const explicitSurfaces = payload?.surfaces && typeof payload.surfaces === 'object' ? payload.surfaces : null;

  if (!explicitSurfaces) {
    return bySurface;
  }

  for (const [surfaceKey, surfacePayload] of Object.entries(explicitSurfaces)) {
    if (!template?.surfaces?.[surfaceKey]) {
      continue;
    }

    const current = bySurface.get(surfaceKey) || {
      surfaceKey,
      position: template.surfaces?.[surfaceKey]?.position || null,
      domId: template.surfaces?.[surfaceKey]?.domId || [],
      decorationMethod: null,
      images: [],
    };

    current.images.push(...(Array.isArray(surfacePayload?.images) ? surfacePayload.images : []));
    bySurface.set(surfaceKey, current);
  }

  return bySurface;
}

function normalizeSceneKey(value) {
  return String(value || '').trim();
}

function getTemplatePreviewScenes(template) {
  if (!Array.isArray(template?.previewScenes)) {
    return [];
  }

  return template.previewScenes
    .filter((scene) => scene?.isActive !== false && normalizeSceneKey(scene?.key))
    .sort((left, right) => (
      (left?.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right?.sortOrder ?? Number.MAX_SAFE_INTEGER)
      ));
}

function resolveRequestedSceneKeys(template, payload) {
  const templatePreviewScenes = getTemplatePreviewScenes(template);
  const requestedSceneKeys = Array.isArray(payload?.sceneKeys)
    ? payload.sceneKeys
      .map((value) => normalizeSceneKey(value))
      .filter(Boolean)
    : [];

  if (requestedSceneKeys.length > 0 && templatePreviewScenes.length > 0) {
    const supportedSurfaceKeys = new Set(template?.supportedSurfaces || SURFACE_KEYS);
    const templatePreviewSceneKeys = new Set(templatePreviewScenes.map((scene) => normalizeSceneKey(scene?.key)));
    const requestedSurfaceKeys = requestedSceneKeys.filter((sceneKey) => supportedSurfaceKeys.has(sceneKey));
    const hasLegacySurfaceSceneKeys = requestedSurfaceKeys.some((sceneKey) => !templatePreviewSceneKeys.has(sceneKey));

    if (hasLegacySurfaceSceneKeys) {
      const requestedSurfaceKeySet = new Set(requestedSurfaceKeys);
      const mappedSceneKeys = templatePreviewScenes
        .filter((scene) => {
          const sceneSurfaceKeys = Array.isArray(scene?.surfaceKeys) && scene.surfaceKeys.length > 0
            ? scene.surfaceKeys.map((surfaceKey) => normalizeSceneKey(surfaceKey)).filter(Boolean)
            : [normalizeSceneKey(scene?.key)].filter(Boolean);

          return sceneSurfaceKeys.some((surfaceKey) => requestedSurfaceKeySet.has(surfaceKey));
        })
        .map((scene) => normalizeSceneKey(scene?.key))
        .filter(Boolean);

      if (mappedSceneKeys.length > 0) {
        return [...new Set(mappedSceneKeys)];
      }
    }
  }

  if (requestedSceneKeys.length > 0) {
    return [...new Set(requestedSceneKeys)];
  }

  if (payload?.surfaceKey) {
    return [normalizeSceneKey(payload.surfaceKey)];
  }

  const hasLegacyPlaceholders = Array.isArray(payload?.print?.placeholders) && payload.print.placeholders.length > 0;
  if (hasLegacyPlaceholders) {
    return resolveRequestedSurfaceKeys(template, payload?.print, payload?.surfaceKey);
  }

  if (templatePreviewScenes.length > 0) {
    return templatePreviewScenes.map((scene) => scene.key);
  }

  return resolveRequestedSurfaceKeys(template, payload?.print, payload?.surfaceKey);
}

function getSceneDefinition(template, manifest, sceneKey) {
  const normalizedSceneKey = normalizeSceneKey(sceneKey);
  if (!normalizedSceneKey) {
    return null;
  }

  const templateScene = getTemplatePreviewScenes(template).find((scene) => scene.key === normalizedSceneKey) || null;
  const templateSceneRender =
    templateScene?.render && typeof templateScene.render === 'object'
      ? templateScene.render
      : null;
  const manifestScene =
    manifest?.scenes && typeof manifest.scenes === 'object'
      ? manifest.scenes[normalizedSceneKey] || null
      : null;

  if (!templateScene && !manifestScene) {
    return null;
  }

  return {
    key: normalizedSceneKey,
    label: templateScene?.label || manifestScene?.label || normalizedSceneKey,
    sortOrder: templateScene?.sortOrder ?? manifestScene?.sortOrder ?? 0,
    surfaceKeys: Array.isArray(templateScene?.surfaceKeys) && templateScene.surfaceKeys.length > 0
      ? templateScene.surfaceKeys
      : Array.isArray(manifestScene?.surfaceKeys)
        ? manifestScene.surfaceKeys
        : [],
    isDefault: templateScene?.isDefault === true,
    baseSurfaceKey: templateSceneRender?.baseSurfaceKey || manifestScene?.baseSurfaceKey || null,
    baseImageUrl: templateSceneRender?.baseImageUrl || manifestScene?.baseImageUrl || null,
    basePattern: templateSceneRender?.basePattern || manifestScene?.basePattern || null,
    outputWidth: templateSceneRender?.outputWidth || manifestScene?.outputWidth || null,
    outputHeight: templateSceneRender?.outputHeight || manifestScene?.outputHeight || null,
    layers: Array.isArray(templateSceneRender?.layers) && templateSceneRender.layers.length > 0
      ? templateSceneRender.layers
      : Array.isArray(manifestScene?.layers)
        ? manifestScene.layers
        : [],
    overlays: Array.isArray(templateSceneRender?.overlays) && templateSceneRender.overlays.length > 0
      ? templateSceneRender.overlays
      : Array.isArray(manifestScene?.overlays)
        ? manifestScene.overlays
        : [],
  };
}

function getLocalAbsolutePathFromPublicUrl(assetUrl) {
  const normalizedInput = String(assetUrl || '').trim();
  if (!normalizedInput) {
    return null;
  }

  let normalizedUrl = normalizedInput;
  if (/^https?:\/\//i.test(normalizedInput)) {
    try {
      normalizedUrl = new URL(normalizedInput).pathname || normalizedInput;
    } catch {
      normalizedUrl = normalizedInput;
    }
  }

  if (!normalizedUrl) {
    return null;
  }

  if (normalizedUrl.startsWith('/mockups/')) {
    const relativePath = normalizedUrl.replace(/^\/mockups\//, '');
    const absolutePath = path.resolve(MOCKUP_ROOT, relativePath);

    if (!absolutePath.startsWith(MOCKUP_ROOT)) {
      throw new ApiError(400, 'Invalid mockup asset path');
    }

    return absolutePath;
  }

  if (normalizedUrl.startsWith('/uploads/')) {
    const uploadRoot = getUploadRootAbsolutePath();
    const relativePath = normalizedUrl.replace(/^\/uploads\//, '');
    const absolutePath = path.resolve(uploadRoot, relativePath);

    if (!absolutePath.startsWith(uploadRoot)) {
      throw new ApiError(400, 'Invalid upload asset path');
    }

    return absolutePath;
  }

  return null;
}

async function doesLocalAssetExist(assetUrl) {
  const localAbsolutePath = getLocalAbsolutePathFromPublicUrl(assetUrl);
  if (!localAbsolutePath) {
    return false;
  }

  try {
    await fs.access(localAbsolutePath);
    return true;
  } catch {
    LOCAL_ASSET_CACHE.delete(localAbsolutePath);
    return false;
  }
}

async function loadMockupManifest(template) {
  const manifestUrl =
    template?.mockupPack?.manifestPath ||
    (template?.mockupPack?.slug ? `/mockups/${template.mockupPack.slug}/manifest.json` : null);

  if (!manifestUrl) {
    return null;
  }

  const localAbsolutePath = getLocalAbsolutePathFromPublicUrl(manifestUrl);
  if (!localAbsolutePath) {
    return null;
  }

  if (LOCAL_MANIFEST_CACHE.has(localAbsolutePath)) {
    try {
      await fs.access(localAbsolutePath);
      return LOCAL_MANIFEST_CACHE.get(localAbsolutePath);
    } catch (error) {
      LOCAL_MANIFEST_CACHE.delete(localAbsolutePath);
      if (error?.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  try {
    const rawManifest = await fs.readFile(localAbsolutePath, 'utf8');
    const parsedManifest = JSON.parse(rawManifest);
    LOCAL_MANIFEST_CACHE.set(localAbsolutePath, parsedManifest);
    return parsedManifest;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    if (error instanceof SyntaxError) {
      throw new ApiError(500, `Invalid mockup manifest JSON: ${manifestUrl}`);
    }

    throw error;
  }
}

function getAvailableMockupColors(template, manifest) {
  if (Array.isArray(template?.availableColors) && template.availableColors.length > 0) {
    return template.availableColors;
  }

  return Array.isArray(manifest?.colors) ? manifest.colors : [];
}

function findMatchingColor(colors, rawValue) {
  if (!rawValue) {
    return null;
  }

  const normalizedKey = normalizeColorKey(rawValue);
  const normalizedHex = normalizeHex(rawValue);

  return colors.find((color) => {
    const colorKey = normalizeColorKey(color?.key || color?.label);
    const colorLabelKey = normalizeColorKey(color?.label);
    const colorHex = normalizeHex(color?.hex);

    return (
      (normalizedKey && (colorKey === normalizedKey || colorLabelKey === normalizedKey)) ||
      (normalizedHex && colorHex === normalizedHex)
    );
  }) || null;
}

function resolveRequestedColorKey(template, payload, manifest) {
  const colors = getAvailableMockupColors(template, manifest);
  const matchedColor = findMatchingColor(colors, payload?.colorKey) || findMatchingColor(colors, payload?.shirtColor);
  const requestedColorKey = matchedColor?.key || normalizeColorKey(payload?.colorKey || payload?.shirtColor);
  const defaultColorKey =
    normalizeColorKey(template?.mockupPack?.defaultColorKey) ||
    normalizeColorKey(manifest?.defaultColorKey) ||
    'white';

  return requestedColorKey || defaultColorKey;
}

function resolveSurfaceFolder(surfaceKey, manifest) {
  return manifest?.surfaceFolders?.[surfaceKey] || (surfaceKey === 'neckLabelInner' ? 'neck-label-inner' : surfaceKey);
}

function fillPattern(pattern, variables) {
  return String(pattern || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => variables[key] ?? '');
}

async function resolveSurfaceBaseAssetUrl({ template, surfaceKey, surface, colorKey, manifest }) {
  const fallbackAssetUrl = surface.render?.baseImageUrl || surface.templateImageUrl || null;
  const basePattern = manifest?.assets?.basePattern || null;

  if (!basePattern) {
    return fallbackAssetUrl;
  }

  const surfaceFolder = resolveSurfaceFolder(surfaceKey, manifest);
  const defaultColorKey =
    normalizeColorKey(manifest?.defaultColorKey) ||
    normalizeColorKey(template?.mockupPack?.defaultColorKey) ||
    'white';
  const candidateColorKeys = [colorKey, defaultColorKey].filter((value, index, array) => value && array.indexOf(value) === index);

  for (const candidateColorKey of candidateColorKeys) {
    const candidateAssetUrl = fillPattern(basePattern, {
      colorKey: candidateColorKey,
      surfaceKey,
      surfaceFolder,
      templateSlug: manifest?.templateSlug || template?.slug || '',
    });

    if (await doesLocalAssetExist(candidateAssetUrl)) {
      return candidateAssetUrl;
    }
  }

  return fallbackAssetUrl;
}

async function loadAssetBuffer(assetUrl, hintedMimeType = null) {
  if (!assetUrl) {
    return null;
  }

  if (String(assetUrl).startsWith('data:')) {
    const [header, base64Payload] = String(assetUrl).split(',', 2);
    const mimeMatch = header.match(/^data:([^;]+);base64$/i);

    return {
      buffer: Buffer.from(base64Payload || '', 'base64'),
      mimeType: mimeMatch?.[1] || hintedMimeType || 'application/octet-stream',
    };
  }

  const localAbsolutePath = getLocalAbsolutePathFromPublicUrl(assetUrl);
  if (localAbsolutePath) {
    if (LOCAL_ASSET_CACHE.has(localAbsolutePath)) {
      try {
        await fs.access(localAbsolutePath);
        return LOCAL_ASSET_CACHE.get(localAbsolutePath);
      } catch (error) {
        LOCAL_ASSET_CACHE.delete(localAbsolutePath);
        throw error;
      }
    }

    let buffer;
    try {
      buffer = await fs.readFile(localAbsolutePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new ApiError(500, `Mockup asset not found: ${assetUrl}`);
      }

      throw error;
    }

    const payload = {
      buffer,
      mimeType: hintedMimeType || getMimeTypeFromFilePath(localAbsolutePath),
    };
    LOCAL_ASSET_CACHE.set(localAbsolutePath, payload);
    return payload;
  }

  if (/^https?:\/\//i.test(String(assetUrl))) {
    const response = await fetch(assetUrl);
    if (!response.ok) {
      throw new ApiError(422, `Failed to load remote asset: ${assetUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: hintedMimeType || response.headers.get('content-type') || 'application/octet-stream',
    };
  }

  throw new ApiError(422, `Unsupported asset URL: ${assetUrl}`);
}

function isMissingAssetError(error) {
  if (!error) {
    return false;
  }

  if (error?.code === 'ENOENT') {
    return true;
  }

  if (
    error instanceof ApiError
    && (
      (error.statusCode === 500 && /^Mockup asset not found:/i.test(error.message))
      || (error.statusCode === 422 && /^Failed to load remote asset:/i.test(error.message))
    )
  ) {
    return true;
  }

  return false;
}

async function loadOptionalAssetBuffer(assetUrl, hintedMimeType = null) {
  try {
    return await loadAssetBuffer(assetUrl, hintedMimeType);
  } catch (error) {
    if (isMissingAssetError(error)) {
      return null;
    }

    throw error;
  }
}

async function loadAssetDataUrl(assetUrl, hintedMimeType = null) {
  const asset = await loadAssetBuffer(assetUrl, hintedMimeType);
  if (!asset) {
    return null;
  }

  return bufferToDataUrl(asset.buffer, asset.mimeType);
}

async function loadOptionalAssetDataUrl(assetUrl, hintedMimeType = null) {
  const asset = await loadOptionalAssetBuffer(assetUrl, hintedMimeType);
  if (!asset) {
    return null;
  }

  return bufferToDataUrl(asset.buffer, asset.mimeType);
}

async function getAssetRecord(assetId) {
  const normalizedAssetId = String(assetId || '').trim();
  if (!normalizedAssetId) {
    return null;
  }

  if (ASSET_RECORD_CACHE.has(normalizedAssetId)) {
    return ASSET_RECORD_CACHE.get(normalizedAssetId);
  }

  const asset = await Asset.findById(normalizedAssetId).lean();
  const normalizedAsset = asset
    ? {
        id: asset._id?.toString() || normalizedAssetId,
        url: asset.url,
        mimeType: asset.mimeType,
        originalName: asset.originalName,
      }
    : null;

  ASSET_RECORD_CACHE.set(normalizedAssetId, normalizedAsset);
  return normalizedAsset;
}

async function resolveLayerAssetSource(layer) {
  const assetId = String(layer?.assetId || '').trim();
  if (assetId) {
    const asset = await getAssetRecord(assetId);
    if (!asset?.url) {
      throw new ApiError(422, `Asset not found for assetId: ${assetId}`);
    }

    return {
      assetUrl: asset.url,
      mimeType: asset.mimeType || layer?.sourceMimeType || layer?.type || null,
      fileName: asset.originalName || layer?.fileName || null,
    };
  }

  return {
    assetUrl: layer?.src || null,
    mimeType: layer?.sourceMimeType || layer?.type || null,
    fileName: layer?.fileName || null,
  };
}

async function getShapeRecord(layer) {
  const normalizedShapeId = String(layer?.shapeId || '').trim();
  const normalizedShapeSlug = String(layer?.shapeSlug || '').trim().toLowerCase();
  const cacheKeys = [];

  if (normalizedShapeId) {
    cacheKeys.push(`id:${normalizedShapeId}`);
  }

  if (normalizedShapeSlug) {
    cacheKeys.push(`slug:${normalizedShapeSlug}`);
  }

  for (const cacheKey of cacheKeys) {
    if (SHAPE_RECORD_CACHE.has(cacheKey)) {
      return SHAPE_RECORD_CACHE.get(cacheKey);
    }
  }

  let shape = null;
  let lookupError = null;

  try {
    if (normalizedShapeId) {
      shape = await shapeService.getShapeById(normalizedShapeId, { activeOnly: false });
    } else if (normalizedShapeSlug) {
      shape = await shapeService.getShapeBySlug(normalizedShapeSlug, { activeOnly: false });
    }
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 404) {
      throw error;
    }

    lookupError = error;
  }

  if (shape) {
    const shapeIdCacheKey = shape.id ? `id:${shape.id}` : null;
    const shapeSlugCacheKey = shape.slug ? `slug:${shape.slug}` : null;

    [shapeIdCacheKey, shapeSlugCacheKey, ...cacheKeys]
      .filter(Boolean)
      .forEach((cacheKey) => {
        SHAPE_RECORD_CACHE.set(cacheKey, shape);
      });
  }

  return {
    shape,
    lookupError,
  };
}

async function resolveShapeLayer(layer) {
  const normalizedShapeId = String(layer?.shapeId || '').trim();
  const normalizedShapeSlug = String(layer?.shapeSlug || '').trim().toLowerCase();
  const { shape, lookupError } = await getShapeRecord(layer);
  const pathCommands = String(shape?.geometry?.pathCommands || layer?.pathCommands || '').trim();

  if (!pathCommands) {
    if (lookupError && (normalizedShapeId || normalizedShapeSlug)) {
      throw new ApiError(422, `Shape layer could not be resolved from shapeId/shapeSlug: ${normalizedShapeId || normalizedShapeSlug}`);
    }

    throw new ApiError(422, 'Shape layer is missing geometry');
  }

  const width =
    Number.isFinite(Number(layer?.width)) && Number(layer.width) > 0
      ? Number(layer.width)
      : Number(shape?.geometry?.defaultWidth) || 100;
  const height =
    Number.isFinite(Number(layer?.height)) && Number(layer.height) > 0
      ? Number(layer.height)
      : Number(shape?.geometry?.defaultHeight) || 100;

  return {
    ...layer,
    shapeId: String(layer?.shapeId || shape?.id || '').trim() || undefined,
    shapeSlug: String(layer?.shapeSlug || shape?.slug || '').trim().toLowerCase() || undefined,
    pathCommands,
    width,
    height,
    name: layer?.name || shape?.name || layer?.shapeSlug || 'Shape',
  };
}

async function getAssetMetadata(assetUrl) {
  if (!assetUrl) {
    return null;
  }

  const asset = await loadAssetBuffer(assetUrl);
  if (!asset) {
    return null;
  }

  return sharp(asset.buffer).metadata();
}

async function rasterizeAssetToPng(assetUrl, width, height) {
  if (!assetUrl) {
    return null;
  }

  const asset = await loadAssetBuffer(assetUrl);
  if (!asset) {
    return null;
  }

  return sharp(asset.buffer)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();
}

async function rasterizeOptionalAssetToPng(assetUrl, width, height) {
  if (!assetUrl) {
    return null;
  }

  const asset = await loadOptionalAssetBuffer(assetUrl);
  if (!asset) {
    return null;
  }

  return sharp(asset.buffer)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();
}

async function createBlankPng(width, height) {
  return createTransparentCanvas(width, height);
}

async function fitCompositeInputWithinCanvas(inputBuffer, left, top, canvasWidth, canvasHeight) {
  if (!inputBuffer) {
    return null;
  }

  const metadata = await sharp(inputBuffer).metadata();
  const inputWidth = roundDimension(metadata?.width);
  const inputHeight = roundDimension(metadata?.height);
  const safeCanvasWidth = roundDimension(canvasWidth);
  const safeCanvasHeight = roundDimension(canvasHeight);
  const sourceLeft = Math.max(0, -left);
  const sourceTop = Math.max(0, -top);
  const targetLeft = Math.max(0, left);
  const targetTop = Math.max(0, top);
  const visibleWidth = Math.min(inputWidth - sourceLeft, safeCanvasWidth - targetLeft);
  const visibleHeight = Math.min(inputHeight - sourceTop, safeCanvasHeight - targetTop);

  if (visibleWidth <= 0 || visibleHeight <= 0) {
    return null;
  }

  const clippedInput = (
    sourceLeft > 0
    || sourceTop > 0
    || visibleWidth < inputWidth
    || visibleHeight < inputHeight
  )
    ? await sharp(inputBuffer)
        .extract({
          left: sourceLeft,
          top: sourceTop,
          width: visibleWidth,
          height: visibleHeight,
        })
        .png()
        .toBuffer()
    : inputBuffer;

  return {
    input: clippedInput,
    left: targetLeft,
    top: targetTop,
  };
}

async function placeDesignOnCanvas(designBuffer, outputWidth, outputHeight, renderPrintArea) {
  const left = Math.round(Number(renderPrintArea.x) || 0);
  const top = Math.round(Number(renderPrintArea.y) || 0);
  const width = roundDimension(renderPrintArea.width);
  const height = roundDimension(renderPrintArea.height);
  const resizedDesign = await sharp(designBuffer)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();
  const compositeInput = await fitCompositeInputWithinCanvas(
    resizedDesign,
    left,
    top,
    outputWidth,
    outputHeight,
  );

  if (!compositeInput) {
    return createBlankPng(outputWidth, outputHeight);
  }

  return sharp(await createBlankPng(outputWidth, outputHeight))
    .composite([
      {
        input: compositeInput.input,
        left: compositeInput.left,
        top: compositeInput.top,
      },
    ])
    .png()
    .toBuffer();
}

function buildAffinePlacementFromQuad(printQuad, sourceWidth, sourceHeight) {
  const normalizedPrintQuad = normalizePrintQuad(printQuad);
  const bounds = getPrintQuadBounds(normalizedPrintQuad);
  const compositeLeft = Math.floor(bounds.x);
  const compositeTop = Math.floor(bounds.y);
  const localTopLeft = {
    x: normalizedPrintQuad.topLeft.x - compositeLeft,
    y: normalizedPrintQuad.topLeft.y - compositeTop,
  };
  const localTopRight = {
    x: normalizedPrintQuad.topRight.x - compositeLeft,
    y: normalizedPrintQuad.topRight.y - compositeTop,
  };
  const localBottomLeft = {
    x: normalizedPrintQuad.bottomLeft.x - compositeLeft,
    y: normalizedPrintQuad.bottomLeft.y - compositeTop,
  };
  const compositeWidth = Math.max(1, Math.ceil(bounds.x + bounds.width) - compositeLeft);
  const compositeHeight = Math.max(1, Math.ceil(bounds.y + bounds.height) - compositeTop);

  return {
    svgMatrix: {
      a: (localTopRight.x - localTopLeft.x) / Number(sourceWidth),
      b: (localTopRight.y - localTopLeft.y) / Number(sourceWidth),
      c: (localBottomLeft.x - localTopLeft.x) / Number(sourceHeight),
      d: (localBottomLeft.y - localTopLeft.y) / Number(sourceHeight),
      e: localTopLeft.x,
      f: localTopLeft.y,
    },
    compositeLeft,
    compositeTop,
    compositeWidth,
    compositeHeight,
    bounds,
  };
}

async function placeDesignOnQuad(designBuffer, outputWidth, outputHeight, renderPrintQuad) {
  const metadata = await sharp(designBuffer).metadata();
  const sourceWidth = roundDimension(metadata?.width);
  const sourceHeight = roundDimension(metadata?.height);
  const affinePlacement = buildAffinePlacementFromQuad(renderPrintQuad, sourceWidth, sourceHeight);
  const designDataUrl = bufferToDataUrl(designBuffer, 'image/png');
  const transformedDesign = await rasterizeSvgToPng(
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${affinePlacement.compositeWidth} ${affinePlacement.compositeHeight}" width="${affinePlacement.compositeWidth}" height="${affinePlacement.compositeHeight}">
        <image
          x="0"
          y="0"
          width="${sourceWidth}"
          height="${sourceHeight}"
          preserveAspectRatio="none"
          href="${designDataUrl}"
          transform="matrix(${affinePlacement.svgMatrix.a} ${affinePlacement.svgMatrix.b} ${affinePlacement.svgMatrix.c} ${affinePlacement.svgMatrix.d} ${affinePlacement.svgMatrix.e} ${affinePlacement.svgMatrix.f})"
        />
      </svg>
    `,
    affinePlacement.compositeWidth,
    affinePlacement.compositeHeight,
  );
  const compositeInput = await fitCompositeInputWithinCanvas(
    transformedDesign,
    affinePlacement.compositeLeft,
    affinePlacement.compositeTop,
    outputWidth,
    outputHeight,
  );

  if (!compositeInput) {
    return createBlankPng(outputWidth, outputHeight);
  }

  return sharp(await createBlankPng(outputWidth, outputHeight))
    .composite([
      {
        input: compositeInput.input,
        left: compositeInput.left,
        top: compositeInput.top,
      },
    ])
    .png()
    .toBuffer();
}

async function applyMaskBuffer(sourceBuffer, maskAssetUrl, width, height) {
  if (!maskAssetUrl) {
    return sourceBuffer;
  }

  const maskAsset = await loadOptionalAssetBuffer(maskAssetUrl);
  if (!maskAsset) {
    return sourceBuffer;
  }

  const [{ data: sourceData, info }, maskChannel] = await Promise.all([
    sharp(sourceBuffer)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(maskAsset.buffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .extractChannel(0)
      .raw()
      .toBuffer(),
  ]);

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const alphaIndex = (pixelIndex * 4) + 3;
    sourceData[alphaIndex] = Math.round((sourceData[alphaIndex] * maskChannel[pixelIndex]) / 255);
  }

  return sharp(sourceData, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

async function buildShadowOverlay(assetUrl, width, height) {
  if (!assetUrl) {
    return null;
  }

  const asset = await loadOptionalAssetBuffer(assetUrl);
  if (!asset) {
    return null;
  }

  const { data, info } = await sharp(asset.buffer)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const channelIndex = pixelIndex * 4;
    const gray = data[channelIndex];
    const softenedGray = Math.round(255 - ((255 - gray) * 0.55));
    const alpha = data[channelIndex + 3];
    const softenedAlpha = Math.round(alpha * 0.7);

    data[channelIndex] = softenedGray;
    data[channelIndex + 1] = softenedGray;
    data[channelIndex + 2] = softenedGray;
    data[channelIndex + 3] = softenedAlpha;
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

async function buildHighlightOverlay(assetUrl, width, height) {
  if (!assetUrl) {
    return null;
  }

  const baseline = 253;
  const asset = await loadOptionalAssetBuffer(assetUrl);
  if (!asset) {
    return null;
  }

  const { data, info } = await sharp(asset.buffer)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const channelIndex = pixelIndex * 4;
    const gray = data[channelIndex];
    const originalAlpha = data[channelIndex + 3];
    const delta = Math.max(0, gray - baseline);
    const mappedGray = clamp(delta * 24, 0, 64);
    const mappedAlpha = Math.round((originalAlpha * clamp(delta / 3, 0, 1)) * 0.35);

    data[channelIndex] = mappedGray;
    data[channelIndex + 1] = mappedGray;
    data[channelIndex + 2] = mappedGray;
    data[channelIndex + 3] = mappedAlpha;
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

async function maskOverlayBySourceAlpha(overlayBuffer, sourceBuffer, width, height) {
  if (!overlayBuffer) {
    return null;
  }

  const [{ data: overlayData, info }, sourceAlpha] = await Promise.all([
    sharp(overlayBuffer)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(sourceBuffer)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .extractChannel(3)
      .raw()
      .toBuffer(),
  ]);

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const alphaIndex = (pixelIndex * 4) + 3;
    overlayData[alphaIndex] = Math.round((overlayData[alphaIndex] * sourceAlpha[pixelIndex]) / 255);
  }

  return sharp(overlayData, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

function getEditorPrintArea(surface) {
  return surface?.editor?.printArea || surface?.printArea || null;
}

function getRenderPrintArea(surface) {
  return surface?.render?.printArea || surface?.printArea || null;
}

function mergeSceneLayerConfig(surface, sceneLayer, configuredSceneWidth, configuredSceneHeight) {
  const inheritSurfaceRender = sceneLayer?.inheritSurfaceRender !== false;
  const surfaceRender = inheritSurfaceRender ? (toPlainObject(surface?.render) || {}) : {};
  const sceneLayerRender = toPlainObject(sceneLayer?.render) || {};
  const layerAssets = toPlainObject(sceneLayer?.assets) || {};
  const layerBlendModes = toPlainObject(sceneLayer?.blendModes) || {};
  const layerDisplacement = toPlainObject(sceneLayer?.displacement) || {};
  const rotationDeg = Number(sceneLayer?.rotationDeg) || 0;

  return {
    editorPrintArea: sceneLayer?.editorPrintArea || getEditorPrintArea(surface),
    sourceCrop: toPlainObject(sceneLayer?.sourceCrop) || null,
    renderPrintArea: sceneLayer?.printArea || sceneLayerRender.printArea || getRenderPrintArea(surface),
    renderPrintQuad: sceneLayer?.printQuad || sceneLayerRender.printQuad || surfaceRender.printQuad || null,
    rotationDeg,
    forceConfiguredSpace: Boolean(sceneLayer?.configuredWidth || sceneLayer?.configuredHeight),
    assets: {
      ...(surfaceRender.assets || {}),
      ...layerAssets,
    },
    blendModes: {
      ...(surfaceRender.blendModes || {}),
      ...layerBlendModes,
    },
    displacement: {
      ...(surfaceRender.displacement || {}),
      ...layerDisplacement,
    },
    configuredWidth: Number(
      sceneLayer?.configuredWidth
      || sceneLayer?.outputWidth
      || sceneLayerRender.outputWidth
      || surfaceRender.outputWidth
      || configuredSceneWidth,
    ),
    configuredHeight: Number(
      sceneLayer?.configuredHeight
      || sceneLayer?.outputHeight
      || sceneLayerRender.outputHeight
      || surfaceRender.outputHeight
      || configuredSceneHeight,
    ),
  };
}

async function cropDesignBufferToSourceCrop(buffer, sourceCropInEditorSpace, editorWidth, editorHeight) {
  if (!sourceCropInEditorSpace) {
    return buffer;
  }

  const resizedBuffer = await sharp(buffer)
    .resize(roundDimension(editorWidth), roundDimension(editorHeight), { fit: 'fill' })
    .png()
    .toBuffer();

  return sharp(resizedBuffer)
    .extract({
      left: roundDimension(sourceCropInEditorSpace.x, 0),
      top: roundDimension(sourceCropInEditorSpace.y, 0),
      width: roundDimension(sourceCropInEditorSpace.width),
      height: roundDimension(sourceCropInEditorSpace.height),
    })
    .png()
    .toBuffer();
}

async function compositeAssetOverBuffer(sourceBuffer, assetUrl, width, height, blend = 'over') {
  if (!assetUrl) {
    return sourceBuffer;
  }

  const overlay = await rasterizeOptionalAssetToPng(assetUrl, width, height);
  if (!overlay) {
    return sourceBuffer;
  }

  return sharp(sourceBuffer)
    .composite([
      {
        input: overlay,
        blend,
      },
    ])
    .png()
    .toBuffer();
}

async function compositeBufferOverBuffer(sourceBuffer, overlayBuffer, blend = 'over') {
  if (!overlayBuffer) {
    return sourceBuffer;
  }

  return sharp(sourceBuffer)
    .composite([
      {
        input: overlayBuffer,
        blend,
      },
    ])
    .png()
    .toBuffer();
}

async function composeSurfaceDesignStages({
  surfacePayload,
  editorPrintArea,
  sourceCrop,
  renderPrintArea,
  renderPrintQuad,
  rotationDeg,
  forceConfiguredSpace,
  renderAssets,
  blendModes,
  displacementConfig,
  configuredWidth,
  configuredHeight,
  outputWidth,
  outputHeight,
}) {
  if (!editorPrintArea || (!renderPrintArea && !renderPrintQuad)) {
    throw new ApiError(422, 'Scene surface layer is missing printArea or printQuad configuration');
  }

  const shadowAssetUrl = renderAssets?.shadowImageUrl || null;
  const highlightAssetUrl = renderAssets?.highlightImageUrl || null;

  const renderPrintAreaInAssetSpace = renderPrintArea
    ? resolveRenderPrintAreaSpace({
        printArea: renderPrintArea,
        configuredWidth: configuredWidth || outputWidth,
        configuredHeight: configuredHeight || outputHeight,
        actualWidth: outputWidth,
        actualHeight: outputHeight,
        forceScale: forceConfiguredSpace,
      })
    : null;
  const renderPrintQuadInAssetSpace = renderPrintQuad
    ? resolveRenderPrintQuadSpace({
        printQuad: renderPrintQuad,
        configuredWidth: configuredWidth || outputWidth,
        configuredHeight: configuredHeight || outputHeight,
        actualWidth: outputWidth,
        actualHeight: outputHeight,
        forceScale: forceConfiguredSpace,
      })
    : null;
  const rotatedPrintQuadInAssetSpace =
    !renderPrintQuadInAssetSpace && renderPrintAreaInAssetSpace && Math.abs(Number(rotationDeg) || 0) > 0
      ? buildPrintQuadFromRotatedRect(renderPrintAreaInAssetSpace, rotationDeg)
      : null;
  const effectiveRenderPrintQuadInAssetSpace = renderPrintQuadInAssetSpace || rotatedPrintQuadInAssetSpace;
  const renderPrintQuadBounds = renderPrintQuadInAssetSpace
    ? getPrintQuadBounds(renderPrintQuadInAssetSpace)
    : effectiveRenderPrintQuadInAssetSpace
      ? getPrintQuadBounds(effectiveRenderPrintQuadInAssetSpace)
    : null;
  const renderWidth = Number(renderPrintAreaInAssetSpace?.width || renderPrintQuadBounds?.width || 0);
  const renderHeight = Number(renderPrintAreaInAssetSpace?.height || renderPrintQuadBounds?.height || 0);
  const editorWidth = Number(editorPrintArea.width);
  const editorHeight = Number(editorPrintArea.height);
  const sourceCropInEditorSpace = resolveSourceCropInEditorSpace(sourceCrop, editorWidth, editorHeight);

  const designSvg = await buildDesignSvg(
    surfacePayload,
    editorWidth,
    editorHeight,
  );
  const fullDesignBuffer = await rasterizeSvgToPng(
    designSvg,
    roundDimension(editorWidth),
    roundDimension(editorHeight),
  );
  const croppedDesignBuffer = await cropDesignBufferToSourceCrop(
    fullDesignBuffer,
    sourceCropInEditorSpace,
    editorWidth,
    editorHeight,
  );
  const designBuffer = await sharp(croppedDesignBuffer)
    .resize(roundDimension(renderWidth), roundDimension(renderHeight), { fit: 'fill' })
    .png()
    .toBuffer();

  const placedDesign = effectiveRenderPrintQuadInAssetSpace
    ? await placeDesignOnQuad(designBuffer, outputWidth, outputHeight, effectiveRenderPrintQuadInAssetSpace)
    : await placeDesignOnCanvas(designBuffer, outputWidth, outputHeight, renderPrintAreaInAssetSpace);
  const maskedDesign = placedDesign;
  const warpedDesign = placedDesign;
  const clippedWarpedDesign = placedDesign;
  const shadowOverlay = null;
  const shadowedDesign = placedDesign;
  const highlightOverlay = null;
  const designComposite = placedDesign;

  return {
    editorPrintArea,
    sourceCropInEditorSpace,
    renderPrintAreaInAssetSpace,
    renderPrintQuadInAssetSpace,
    rotatedPrintQuadInAssetSpace,
    effectiveRenderPrintQuadInAssetSpace,
    renderPrintQuadBounds,
    renderWidth,
    renderHeight,
    designSvg,
    fullDesignBuffer,
    croppedDesignBuffer,
    designBuffer,
    placedDesign,
    maskedDesign,
    warpedDesign,
    clippedWarpedDesign,
    shadowOverlay,
    shadowedDesign,
    highlightOverlay,
    designComposite,
    assetUrls: {
      shadowAssetUrl,
      highlightAssetUrl,
      maskAssetUrl: renderAssets?.maskImageUrl || null,
      displacementAssetUrl: renderAssets?.displacementImageUrl || null,
      occlusionAssetUrl: renderAssets?.occlusionImageUrl || null,
    },
  };
}

async function composeSurfaceDesignBuffer(args) {
  const stages = await composeSurfaceDesignStages(args);
  return stages.designComposite;
}

function resolveSceneLightingConfig(sceneDefinition, template, configuredSceneWidth, configuredSceneHeight) {
  if (!Array.isArray(sceneDefinition?.layers)) {
    return {
      shadowAssetUrl: null,
      highlightAssetUrl: null,
      blendModes: {},
    };
  }

  let shadowAssetUrl = null;
  let highlightAssetUrl = null;
  let shadowBlend = null;
  let highlightBlend = null;

  for (const layer of sceneDefinition.layers) {
    if (layer?.type !== 'surface') {
      continue;
    }

    const surfaceKey = String(layer.surfaceKey || '').trim();
    const surface = template?.surfaces?.[surfaceKey];
    if (!surface) {
      continue;
    }

    const mergedLayerConfig = mergeSceneLayerConfig(surface, layer, configuredSceneWidth, configuredSceneHeight);

    if (!shadowAssetUrl && mergedLayerConfig.assets?.shadowImageUrl) {
      shadowAssetUrl = mergedLayerConfig.assets.shadowImageUrl;
    }

    if (!highlightAssetUrl && mergedLayerConfig.assets?.highlightImageUrl) {
      highlightAssetUrl = mergedLayerConfig.assets.highlightImageUrl;
    }

    if (!shadowBlend && mergedLayerConfig.blendModes?.shadow) {
      shadowBlend = mergedLayerConfig.blendModes.shadow;
    }

    if (!highlightBlend && mergedLayerConfig.blendModes?.highlight) {
      highlightBlend = mergedLayerConfig.blendModes.highlight;
    }
  }

  return {
    shadowAssetUrl,
    highlightAssetUrl,
    blendModes: {
      shadow: shadowBlend || 'multiply',
      highlight: highlightBlend || 'screen',
    },
  };
}

async function applySceneLightingToDesignGroup({
  designGroupBuffer,
  shadowAssetUrl,
  highlightAssetUrl,
  blendModes,
  outputWidth,
  outputHeight,
}) {
  let litDesignGroup = designGroupBuffer;

  const shadowOverlay = await maskOverlayBySourceAlpha(
    await buildShadowOverlay(shadowAssetUrl, outputWidth, outputHeight),
    designGroupBuffer,
    outputWidth,
    outputHeight,
  );

  if (shadowOverlay) {
    litDesignGroup = await sharp(litDesignGroup)
      .composite([
        {
          input: shadowOverlay,
          blend: blendModes?.shadow || 'multiply',
        },
      ])
      .png()
      .toBuffer();
  }

  const highlightOverlay = await maskOverlayBySourceAlpha(
    await buildHighlightOverlay(highlightAssetUrl, outputWidth, outputHeight),
    designGroupBuffer,
    outputWidth,
    outputHeight,
  );

  if (highlightOverlay) {
    litDesignGroup = await sharp(litDesignGroup)
      .composite([
        {
          input: highlightOverlay,
          blend: blendModes?.highlight || 'screen',
        },
      ])
      .png()
      .toBuffer();
  }

  return {
    litDesignGroup,
    shadowOverlay,
    highlightOverlay,
  };
}

async function resolveSceneBaseAssetUrl({ template, sceneKey, sceneDefinition, colorKey, manifest }) {
  if (sceneDefinition?.basePattern) {
    const defaultColorKey =
      normalizeColorKey(manifest?.defaultColorKey) ||
      normalizeColorKey(template?.mockupPack?.defaultColorKey) ||
      'white';
    const candidateColorKeys = [colorKey, defaultColorKey].filter(
      (value, index, array) => value && array.indexOf(value) === index,
    );

    for (const candidateColorKey of candidateColorKeys) {
      const candidateAssetUrl = fillPattern(sceneDefinition.basePattern, {
        colorKey: candidateColorKey,
        sceneKey,
        templateSlug: manifest?.templateSlug || template?.slug || '',
      });

      if (await doesLocalAssetExist(candidateAssetUrl)) {
        return candidateAssetUrl;
      }
    }
  }

  if (sceneDefinition?.baseImageUrl) {
    return sceneDefinition.baseImageUrl;
  }

  const candidateSurfaceKey =
    sceneDefinition?.baseSurfaceKey ||
    sceneDefinition?.layers?.find((layer) => layer?.type === 'surface' && layer?.surfaceKey)?.surfaceKey ||
    sceneKey;

  if (!candidateSurfaceKey || !template?.surfaces?.[candidateSurfaceKey]) {
    return null;
  }

  return resolveSurfaceBaseAssetUrl({
    template,
    surfaceKey: candidateSurfaceKey,
    surface: template.surfaces[candidateSurfaceKey],
    colorKey,
    manifest,
  });
}

function buildSvgTextFallbackMarkup({
  text,
  lines,
  fontSize,
  lineHeight,
  textAlign,
  baseWidth,
  fill,
  fontFamily,
  fontWeight,
  fontStyle,
}) {
  const textAnchor = textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start';
  const x = textAlign === 'center' ? baseWidth / 2 : textAlign === 'right' ? baseWidth : 0;
  const y = fontSize;
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  return `
    <text
      x="${x}"
      y="${y}"
      fill="${escapeXml(fill)}"
      font-family="${escapeXml(fontFamily)}"
      font-size="${fontSize}"
      font-weight="${escapeXml(fontWeight)}"
      font-style="${escapeXml(fontStyle)}"
      text-anchor="${textAnchor}"
      dominant-baseline="text-before-edge"
    >${tspans}</text>
  `;
}

async function buildTextLayerMarkup(layer, baseWidth, baseHeight) {
  const rawText =
    typeof layer.textInput === 'string'
      ? layer.textInput
      : typeof layer.name === 'string' && !layer.name.toLowerCase().endsWith('.svg')
        ? layer.name
        : '';
  const text = rawText.trim();

  if (!text) {
    return '';
  }

  const lines = text.split(/\r?\n/);
  const fontSize = Number(layer.baselineFontSize) || Math.max(16, Math.round(baseHeight * 0.85));
  const lineHeight = Number(layer.lineHeight) || fontSize * 1.2;
  const textAlign = layer.textAlign || 'left';
  const fill = layer.color || '#000000';
  const fontFamily = layer.fontFamily || 'Arial';
  const fontWeight = layer.fontWeight ?? 400;
  const fontStyle = layer.fontStyle || 'normal';
  const anchor = textAlign === 'center' ? 'center top' : textAlign === 'right' ? 'right top' : 'left top';
  const x = textAlign === 'center' ? baseWidth / 2 : textAlign === 'right' ? baseWidth : 0;
  const textToSvgRenderer = await getTextToSvg({
    fontFamily,
    fontWeight,
    fontStyle,
  });

  if (!textToSvgRenderer?.textToSVG) {
    return buildSvgTextFallbackMarkup({
      text,
      lines,
      fontSize,
      lineHeight,
      textAlign,
      baseWidth,
      fill,
      fontFamily: `${fontFamily}, Arial, sans-serif`,
      fontWeight,
      fontStyle,
    });
  }

  const pathMarkup = lines
    .map((line, index) => {
      if (!line) {
        return '';
      }

      return textToSvgRenderer.textToSVG.getPath(line, {
        x,
        y: index * lineHeight,
        fontSize,
        anchor,
        attributes: {
          fill: escapeXml(fill),
        },
      });
    })
    .filter(Boolean)
    .join('\n');

  if (!pathMarkup) {
    return '';
  }

  return `
    <g data-font-family="${escapeXml(textToSvgRenderer.family)}" data-font-source="${escapeXml(textToSvgRenderer.source)}">
      ${pathMarkup}
    </g>
  `;
}

function buildShapeLayerMarkup(layer, baseWidth, baseHeight) {
  if (!layer.pathCommands) {
    return '';
  }

  const fillColor = layer.fill?.color || layer.color || '#000000';
  const strokeColor =
    layer.stroke && typeof layer.stroke === 'object'
      ? layer.stroke.color || 'none'
      : typeof layer.stroke === 'string'
        ? layer.stroke
        : 'none';
  const strokeWidth =
    layer.stroke && typeof layer.stroke === 'object'
      ? Number(layer.stroke.width) || Number(layer.strokeWidth) || 0
      : Number(layer.strokeWidth) || 0;

  return `
    <svg x="0" y="0" width="${baseWidth}" height="${baseHeight}" viewBox="0 0 ${baseWidth} ${baseHeight}" preserveAspectRatio="none">
      <path
        d="${escapeXml(layer.pathCommands)}"
        fill="${escapeXml(fillColor)}"
        stroke="${escapeXml(strokeColor)}"
        stroke-width="${strokeWidth}"
      />
    </svg>
  `;
}

async function buildImageLayerMarkup(layer, baseWidth, baseHeight) {
  const resolvedAsset = await resolveLayerAssetSource(layer);
  if (!resolvedAsset.assetUrl) {
    return '';
  }

  const href = await loadAssetDataUrl(resolvedAsset.assetUrl, resolvedAsset.mimeType);

  return `
    <image
      x="0"
      y="0"
      width="${baseWidth}"
      height="${baseHeight}"
      preserveAspectRatio="none"
      href="${href}"
    />
  `;
}

async function buildLayerMarkup(layer, placeholderWidth, placeholderHeight) {
  const layerType = String(layer?.layerType || '').trim().toLowerCase();
  const resolvedLayer = layerType === 'shape' ? await resolveShapeLayer(layer) : layer;
  const x = Number.isFinite(Number(resolvedLayer?.x)) ? Number(resolvedLayer.x) : 0.5;
  const y = Number.isFinite(Number(resolvedLayer?.y)) ? Number(resolvedLayer.y) : 0.5;
  const angle = Number.isFinite(Number(resolvedLayer?.angle)) ? Number(resolvedLayer.angle) : 0;
  const scale =
    Number.isFinite(Number(resolvedLayer?.scale)) && Number(resolvedLayer.scale) > 0
      ? Number(resolvedLayer.scale)
      : 1;
  const baseWidth =
    Number.isFinite(Number(resolvedLayer?.width)) && Number(resolvedLayer.width) > 0
      ? Number(resolvedLayer.width)
      : 100;
  const baseHeight =
    Number.isFinite(Number(resolvedLayer?.height)) && Number(resolvedLayer.height) > 0
      ? Number(resolvedLayer.height)
      : 100;
  const centerX = x * placeholderWidth;
  const centerY = y * placeholderHeight;
  const scaleX = (resolvedLayer?.flipX ? -1 : 1) * scale;
  const scaleY = (resolvedLayer?.flipY ? -1 : 1) * scale;

  let innerMarkup = '';

  if (layerType === 'image') {
    innerMarkup = await buildImageLayerMarkup(resolvedLayer, baseWidth, baseHeight);
  } else if (layerType === 'shape') {
    innerMarkup = buildShapeLayerMarkup(resolvedLayer, baseWidth, baseHeight);
  } else if (layerType === 'text' || layerType === 'careset' || layerType === 'text_layer') {
    innerMarkup = await buildTextLayerMarkup(resolvedLayer, baseWidth, baseHeight);
  }

  if (!innerMarkup) {
    return '';
  }

  return `
    <g transform="translate(${centerX} ${centerY}) rotate(${angle}) scale(${scaleX} ${scaleY}) translate(${-baseWidth / 2} ${-baseHeight / 2})">
      ${innerMarkup}
    </g>
  `;
}

async function buildDesignSvg(surfacePayload, placeholderWidth, placeholderHeight) {
  const layers = Array.isArray(surfacePayload?.images) ? surfacePayload.images : [];
  const markup = [];

  for (const layer of layers) {
    markup.push(await buildLayerMarkup(layer, placeholderWidth, placeholderHeight));
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${placeholderWidth} ${placeholderHeight}" width="${placeholderWidth}" height="${placeholderHeight}">
      ${markup.join('\n')}
    </svg>
  `;
}

async function rasterizeSvgToPng(svgMarkup, width, height) {
  return sharp(Buffer.from(svgMarkup))
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();
}

async function warpDesignBuffer(sourceBuffer, outputWidth, outputHeight, displacementAssetUrl, displacementConfig) {
  if (!displacementAssetUrl) {
    return sourceBuffer;
  }

  const displacementScale = Math.max(
    Math.abs(Number(displacementConfig?.scaleX) || 0),
    Math.abs(Number(displacementConfig?.scaleY) || 0),
    0,
  );

  if (displacementScale <= 0) {
    return sourceBuffer;
  }

  const sourceDataUrl = bufferToDataUrl(sourceBuffer, 'image/png');
  const displacementDataUrl = await loadOptionalAssetDataUrl(displacementAssetUrl);

  if (!displacementDataUrl) {
    return sourceBuffer;
  }

  const blur = Math.max(0, Number(displacementConfig?.blur) || 0);

  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outputWidth} ${outputHeight}" width="${outputWidth}" height="${outputHeight}">
      <defs>
        <filter id="displace" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
          <feImage x="0" y="0" width="${outputWidth}" height="${outputHeight}" preserveAspectRatio="none" href="${displacementDataUrl}" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="${displacementScale}" xChannelSelector="R" yChannelSelector="G" result="warped" />
          ${blur > 0 ? `<feGaussianBlur in="warped" stdDeviation="${blur}" />` : ''}
        </filter>
      </defs>
      <image x="0" y="0" width="${outputWidth}" height="${outputHeight}" preserveAspectRatio="none" href="${sourceDataUrl}" filter="url(#displace)" />
    </svg>
  `;

  return rasterizeSvgToPng(svgMarkup, outputWidth, outputHeight);
}

async function applyBlendMap(sourceBuffer, assetUrl, width, height, blendMode) {
  if (!assetUrl) {
    return sourceBuffer;
  }

  const overlay = await rasterizeOptionalAssetToPng(assetUrl, width, height);
  if (!overlay) {
    return sourceBuffer;
  }

  return sharp(sourceBuffer)
    .composite([
      {
        input: overlay,
        blend: blendMode,
      },
    ])
    .png()
    .toBuffer();
}

async function compositeBuffers({
  width,
  height,
  baseBuffer,
  overlays,
  format,
}) {
  let pipeline = sharp(baseBuffer || (await createTransparentCanvas(width, height)));

  pipeline = pipeline.composite(
    overlays
      .filter((entry) => Boolean(entry?.input))
      .map((entry) => ({
        input: entry.input,
        blend: entry.blend || 'over',
      })),
  );

  const normalizedFormat = normalizeFormat(format);

  if (normalizedFormat === 'jpeg') {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 90 });
  } else if (normalizedFormat === 'webp') {
    pipeline = pipeline.webp({ quality: 90 });
  } else {
    pipeline = pipeline.png();
  }

  return pipeline.toBuffer();
}

async function resizeFinalBuffer(buffer, width, height, requestedSize, format) {
  if (!requestedSize || Math.max(width, height) <= requestedSize) {
    return {
      buffer,
      width,
      height,
    };
  }

  const scale = requestedSize / Math.max(width, height);
  const resizedWidth = Math.max(1, Math.round(width * scale));
  const resizedHeight = Math.max(1, Math.round(height * scale));

  let pipeline = sharp(buffer).resize(resizedWidth, resizedHeight, { fit: 'inside' });
  const normalizedFormat = normalizeFormat(format);

  if (normalizedFormat === 'jpeg') {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 90 });
  } else if (normalizedFormat === 'webp') {
    pipeline = pipeline.webp({ quality: 90 });
  } else {
    pipeline = pipeline.png();
  }

  return {
    buffer: await pipeline.toBuffer(),
    width: resizedWidth,
    height: resizedHeight,
  };
}

async function getAlphaBoundsFromBuffer(buffer, width, height) {
  if (!buffer) {
    return null;
  }

  const { data, info } = await sharp(buffer)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[((y * info.width) + x) * 4 + 3];
      if (alpha <= 0) {
        continue;
      }

      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!count) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: (maxX - minX) + 1,
    height: (maxY - minY) + 1,
    pixelCount: count,
  };
}

async function getAssetAlphaBounds(assetUrl, width, height) {
  if (!assetUrl) {
    return null;
  }

  const rasterizedBuffer = await rasterizeOptionalAssetToPng(assetUrl, width, height);
  if (!rasterizedBuffer) {
    return null;
  }

  return getAlphaBoundsFromBuffer(rasterizedBuffer, width, height);
}

async function getMaskChannelBounds(maskAssetUrl, width, height) {
  if (!maskAssetUrl) {
    return null;
  }

  const maskAsset = await loadOptionalAssetBuffer(maskAssetUrl);
  if (!maskAsset) {
    return null;
  }

  const maskChannel = await sharp(maskAsset.buffer)
    .resize(width, height, { fit: 'fill' })
    .removeAlpha()
    .extractChannel(0)
    .raw()
    .toBuffer();

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = maskChannel[(y * width) + x];
      if (value <= 0) {
        continue;
      }

      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!count) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: (maxX - minX) + 1,
    height: (maxY - minY) + 1,
    pixelCount: count,
  };
}

async function serializeDebugStages(stageBuffers, stageWidth, stageHeight, selectedStageKeys) {
  const stages = {};

  for (const stageKey of selectedStageKeys) {
    if (!stageBuffers?.[stageKey]) {
      continue;
    }

    const pngBuffer = await sharp(stageBuffers[stageKey]).png().toBuffer();
    stages[stageKey] = {
      mimeType: 'image/png',
      width: stageWidth,
      height: stageHeight,
      dataUrl: bufferToDataUrl(pngBuffer, 'image/png'),
    };
  }

  return stages;
}

async function renderSurfacePreview({
  template,
  surfaceKey,
  surfacePayload,
  colorKey,
  manifest,
  format,
  requestedSize,
  debugEnabled = false,
  debugStageKeys = [],
}) {
  const surface = template.surfaces?.[surfaceKey];
  if (!surface) {
    throw new ApiError(404, `Surface ${surfaceKey} not found in template`);
  }

  const editorPrintArea = getEditorPrintArea(surface);
  const renderPrintArea = getRenderPrintArea(surface);
  const baseAssetUrl = await resolveSurfaceBaseAssetUrl({
    template,
    surfaceKey,
    surface,
    colorKey,
    manifest,
  });
  const maskAssetUrl = surface.render?.assets?.maskImageUrl || surface.maskImageUrl || null;
  const shadowAssetUrl = surface.render?.assets?.shadowImageUrl || null;
  const highlightAssetUrl = surface.render?.assets?.highlightImageUrl || null;
  const displacementAssetUrl = surface.render?.assets?.displacementImageUrl || null;

  if (!editorPrintArea || !renderPrintArea) {
    throw new ApiError(422, `Template surface ${surfaceKey} is missing printArea configuration`);
  }

  const assetMetadata =
    (await getAssetMetadata(baseAssetUrl)) ||
    (await getAssetMetadata(maskAssetUrl)) ||
    null;
  const actualOutputWidth = roundDimension(
    assetMetadata?.width || surface.render?.outputWidth || surface.editor?.sceneWidth || renderPrintArea.width,
  );
  const actualOutputHeight = roundDimension(
    assetMetadata?.height || surface.render?.outputHeight || surface.editor?.sceneHeight || renderPrintArea.height,
  );
  const renderPrintAreaInAssetSpace = resolveRenderPrintAreaSpace({
    printArea: renderPrintArea,
    configuredWidth: surface.render?.outputWidth || actualOutputWidth,
    configuredHeight: surface.render?.outputHeight || actualOutputHeight,
    actualWidth: actualOutputWidth,
    actualHeight: actualOutputHeight,
  });
  const renderScale =
    requestedSize && requestedSize > 0
      ? Math.min(1, requestedSize / Math.max(actualOutputWidth, actualOutputHeight))
      : 1;
  const outputWidth = roundDimension(actualOutputWidth * renderScale);
  const outputHeight = roundDimension(actualOutputHeight * renderScale);
  const scaledRenderPrintArea = scalePrintArea(renderPrintAreaInAssetSpace, renderScale);
  const renderWidth = Number(scaledRenderPrintArea.width);
  const renderHeight = Number(scaledRenderPrintArea.height);

  const designSvg = await buildDesignSvg(surfacePayload, Number(editorPrintArea.width), Number(editorPrintArea.height));
  const designBuffer = await rasterizeSvgToPng(designSvg, roundDimension(renderWidth), roundDimension(renderHeight));

  const placedDesign = await placeDesignOnCanvas(designBuffer, outputWidth, outputHeight, scaledRenderPrintArea);
  const occlusionGroupBuffer = await compositeAssetOverBuffer(
    await createBlankPng(outputWidth, outputHeight),
    surface.render?.assets?.occlusionImageUrl || null,
    outputWidth,
    outputHeight,
    'over',
  );
  const { litDesignGroup, shadowOverlay, highlightOverlay } = await applySceneLightingToDesignGroup({
    designGroupBuffer: placedDesign,
    shadowAssetUrl,
    highlightAssetUrl,
    blendModes: surface.render?.blendModes || {},
    outputWidth,
    outputHeight,
  });

  const baseBuffer = await rasterizeAssetToPng(baseAssetUrl, outputWidth, outputHeight);
  let mergedBuffer = await compositeBuffers({
    width: outputWidth,
    height: outputHeight,
    baseBuffer,
    overlays: [
      { input: litDesignGroup, blend: 'over' },
      { input: occlusionGroupBuffer, blend: 'over' },
    ],
    format,
  });

  const resized = await resizeFinalBuffer(mergedBuffer, outputWidth, outputHeight, null, format);
  const debugStages = debugEnabled
    ? await serializeDebugStages(
        {
          base: baseBuffer,
          design: placedDesign,
          masked: placedDesign,
          warped: placedDesign,
          shadowed: litDesignGroup,
          final: resized.buffer,
        },
        resized.width,
        resized.height,
        debugStageKeys,
      )
    : null;

  return {
    sceneKey: surfaceKey,
    surfaceKey,
    label: surface.label || surfaceKey,
    position: surface.position || (surfaceKey === 'neckLabelInner' ? 'neck' : surfaceKey),
    mimeType: getMimeTypeForFormat(format),
    width: resized.width,
    height: resized.height,
    buffer: resized.buffer,
    debugStages,
  };
}

async function renderScenePreview({
  template,
  sceneKey,
  sceneDefinition,
  surfacePayloads,
  colorKey,
  manifest,
  format,
  requestedSize,
}) {
  const fallbackSurface = template.surfaces?.[sceneKey];
  const hasSceneLayers = Array.isArray(sceneDefinition?.layers) && sceneDefinition.layers.length > 0;

  if (!hasSceneLayers) {
    if (!fallbackSurface) {
      throw new ApiError(404, `Scene ${sceneKey} is not configured`);
    }

    const fallbackPreview = await renderSurfacePreview({
      template,
      surfaceKey: sceneKey,
      surfacePayload: surfacePayloads.get(sceneKey) || { images: [] },
      colorKey,
      manifest,
      format,
      requestedSize,
    });

    return {
      ...fallbackPreview,
      sceneKey,
      label: sceneDefinition?.label || fallbackPreview.label || sceneKey,
    };
  }

  const baseAssetUrl = await resolveSceneBaseAssetUrl({
    template,
    sceneKey,
    sceneDefinition,
    colorKey,
    manifest,
  });
  const baseAssetMetadata = baseAssetUrl ? await getAssetMetadata(baseAssetUrl) : null;
  const actualOutputWidth = roundDimension(
    baseAssetMetadata?.width
      || sceneDefinition?.outputWidth
      || fallbackSurface?.render?.outputWidth
      || fallbackSurface?.editor?.sceneWidth
      || 2048,
  );
  const actualOutputHeight = roundDimension(
    baseAssetMetadata?.height
      || sceneDefinition?.outputHeight
      || fallbackSurface?.render?.outputHeight
      || fallbackSurface?.editor?.sceneHeight
      || 2048,
  );
  const renderScale =
    requestedSize && requestedSize > 0
      ? Math.min(1, requestedSize / Math.max(actualOutputWidth, actualOutputHeight))
      : 1;
  const outputWidth = roundDimension(actualOutputWidth * renderScale);
  const outputHeight = roundDimension(actualOutputHeight * renderScale);

  const baseBuffer = baseAssetUrl
    ? await rasterizeAssetToPng(baseAssetUrl, outputWidth, outputHeight)
    : await createBlankPng(outputWidth, outputHeight);
  let designGroupBuffer = await createBlankPng(outputWidth, outputHeight);
  let occlusionGroupBuffer = await createBlankPng(outputWidth, outputHeight);
  const deferredOverlays = [];

  for (const layer of sceneDefinition.layers) {
    if (layer?.type !== 'surface') {
      if (layer?.type === 'overlay' && layer?.assetUrl) {
        deferredOverlays.push(layer);
      }
      continue;
    }

    const surfaceKey = String(layer.surfaceKey || '').trim();
    const surface = template.surfaces?.[surfaceKey];
    if (!surface) {
      continue;
    }

    const mergedLayerConfig = mergeSceneLayerConfig(surface, layer, actualOutputWidth, actualOutputHeight);
    const layerBuffer = await composeSurfaceDesignBuffer({
      surfacePayload: surfacePayloads.get(surfaceKey) || { images: [] },
      editorPrintArea: mergedLayerConfig.editorPrintArea,
      sourceCrop: mergedLayerConfig.sourceCrop,
      renderPrintArea: mergedLayerConfig.renderPrintArea,
      renderPrintQuad: mergedLayerConfig.renderPrintQuad,
      rotationDeg: mergedLayerConfig.rotationDeg,
      forceConfiguredSpace: mergedLayerConfig.forceConfiguredSpace,
      renderAssets: mergedLayerConfig.assets,
      blendModes: mergedLayerConfig.blendModes,
      displacementConfig: mergedLayerConfig.displacement,
      configuredWidth: mergedLayerConfig.configuredWidth,
      configuredHeight: mergedLayerConfig.configuredHeight,
      outputWidth,
      outputHeight,
    });

    designGroupBuffer = await compositeBufferOverBuffer(
      designGroupBuffer,
      layerBuffer,
      layer.blend || 'over',
    );
    occlusionGroupBuffer = await compositeAssetOverBuffer(
      occlusionGroupBuffer,
      mergedLayerConfig.assets?.occlusionImageUrl || null,
      outputWidth,
      outputHeight,
      'over',
    );
  }

  const sceneLightingConfig = resolveSceneLightingConfig(sceneDefinition, template, actualOutputWidth, actualOutputHeight);
  const { litDesignGroup } = await applySceneLightingToDesignGroup({
    designGroupBuffer,
    shadowAssetUrl: sceneLightingConfig.shadowAssetUrl,
    highlightAssetUrl: sceneLightingConfig.highlightAssetUrl,
    blendModes: sceneLightingConfig.blendModes,
    outputWidth,
    outputHeight,
  });

  let composedBuffer = await compositeBuffers({
    width: outputWidth,
    height: outputHeight,
    baseBuffer,
    overlays: [
      { input: litDesignGroup, blend: 'over' },
      { input: occlusionGroupBuffer, blend: 'over' },
    ],
    format,
  });

  for (const layer of deferredOverlays) {
    composedBuffer = await compositeAssetOverBuffer(
      composedBuffer,
      layer.assetUrl,
      outputWidth,
      outputHeight,
      layer.blend || 'over',
    );
  }

  for (const overlay of sceneDefinition.overlays || []) {
    if (!overlay?.assetUrl) {
      continue;
    }

    composedBuffer = await compositeAssetOverBuffer(
      composedBuffer,
      overlay.assetUrl,
      outputWidth,
      outputHeight,
      overlay.blend || 'over',
    );
  }

  const resized = await resizeFinalBuffer(composedBuffer, outputWidth, outputHeight, null, format);

  return {
    sceneKey,
    surfaceKey: fallbackSurface ? sceneKey : null,
    label: sceneDefinition?.label || sceneKey,
    position: sceneKey,
    mimeType: getMimeTypeForFormat(format),
    width: resized.width,
    height: resized.height,
    buffer: resized.buffer,
    debugStages: null,
  };
}

async function debugRenderScenePreview({
  template,
  sceneKey,
  sceneDefinition,
  surfacePayloads,
  colorKey,
  manifest,
  format,
  requestedSize,
}) {
  const fallbackSurface = template.surfaces?.[sceneKey];
  const hasSceneLayers = Array.isArray(sceneDefinition?.layers) && sceneDefinition.layers.length > 0;

  if (!hasSceneLayers) {
    const preview = await renderScenePreview({
      template,
      sceneKey,
      sceneDefinition,
      surfacePayloads,
      colorKey,
      manifest,
      format,
      requestedSize,
    });

    return {
      ...preview,
      debugScene: {
        baseAssetUrl: null,
        outputWidth: preview.width,
        outputHeight: preview.height,
        layers: [],
      },
    };
  }

  const baseAssetUrl = await resolveSceneBaseAssetUrl({
    template,
    sceneKey,
    sceneDefinition,
    colorKey,
    manifest,
  });
  const baseAssetMetadata = baseAssetUrl ? await getAssetMetadata(baseAssetUrl) : null;
  const actualOutputWidth = roundDimension(
    baseAssetMetadata?.width
      || sceneDefinition?.outputWidth
      || fallbackSurface?.render?.outputWidth
      || fallbackSurface?.editor?.sceneWidth
      || 2048,
  );
  const actualOutputHeight = roundDimension(
    baseAssetMetadata?.height
      || sceneDefinition?.outputHeight
      || fallbackSurface?.render?.outputHeight
      || fallbackSurface?.editor?.sceneHeight
      || 2048,
  );
  const renderScale =
    requestedSize && requestedSize > 0
      ? Math.min(1, requestedSize / Math.max(actualOutputWidth, actualOutputHeight))
      : 1;
  const outputWidth = roundDimension(actualOutputWidth * renderScale);
  const outputHeight = roundDimension(actualOutputHeight * renderScale);

  const baseBuffer = baseAssetUrl
    ? await rasterizeAssetToPng(baseAssetUrl, outputWidth, outputHeight)
    : await createBlankPng(outputWidth, outputHeight);
  let designGroupBuffer = await createBlankPng(outputWidth, outputHeight);
  let occlusionGroupBuffer = await createBlankPng(outputWidth, outputHeight);
  const debugLayers = [];
  const deferredOverlays = [];

  for (let layerIndex = 0; layerIndex < sceneDefinition.layers.length; layerIndex += 1) {
    const layer = sceneDefinition.layers[layerIndex];

    if (layer?.type !== 'surface') {
      if (layer?.type === 'overlay' && layer?.assetUrl) {
        deferredOverlays.push({ index: layerIndex, overlay: layer, type: 'layerOverlay' });
      }
      continue;
    }

    const surfaceKey = String(layer.surfaceKey || '').trim();
    const surface = template.surfaces?.[surfaceKey];
    if (!surface) {
      continue;
    }

    const stageBaseBuffer = await compositeBufferOverBuffer(baseBuffer, designGroupBuffer);
    const mergedLayerConfig = mergeSceneLayerConfig(surface, layer, actualOutputWidth, actualOutputHeight);
    const stages = await composeSurfaceDesignStages({
      surfacePayload: surfacePayloads.get(surfaceKey) || { images: [] },
      editorPrintArea: mergedLayerConfig.editorPrintArea,
      sourceCrop: mergedLayerConfig.sourceCrop,
      renderPrintArea: mergedLayerConfig.renderPrintArea,
      renderPrintQuad: mergedLayerConfig.renderPrintQuad,
      rotationDeg: mergedLayerConfig.rotationDeg,
      forceConfiguredSpace: mergedLayerConfig.forceConfiguredSpace,
      renderAssets: mergedLayerConfig.assets,
      blendModes: mergedLayerConfig.blendModes,
      displacementConfig: mergedLayerConfig.displacement,
      configuredWidth: mergedLayerConfig.configuredWidth,
      configuredHeight: mergedLayerConfig.configuredHeight,
      outputWidth,
      outputHeight,
    });

    const [
      designBounds,
      placedBounds,
      maskedBounds,
      warpedBounds,
      clippedBounds,
      compositeBounds,
      maskCoverageBounds,
      occlusionBounds,
    ] = await Promise.all([
      getAlphaBoundsFromBuffer(stages.designBuffer, roundDimension(stages.renderWidth), roundDimension(stages.renderHeight)),
      getAlphaBoundsFromBuffer(stages.placedDesign, outputWidth, outputHeight),
      getAlphaBoundsFromBuffer(stages.maskedDesign, outputWidth, outputHeight),
      getAlphaBoundsFromBuffer(stages.warpedDesign, outputWidth, outputHeight),
      getAlphaBoundsFromBuffer(stages.clippedWarpedDesign, outputWidth, outputHeight),
      getAlphaBoundsFromBuffer(stages.designComposite, outputWidth, outputHeight),
      getMaskChannelBounds(mergedLayerConfig.assets?.maskImageUrl || null, outputWidth, outputHeight),
      getAssetAlphaBounds(mergedLayerConfig.assets?.occlusionImageUrl || null, outputWidth, outputHeight),
    ]);

    const debugRects = [];
    const debugQuads = [];

    if (stages.renderPrintAreaInAssetSpace) {
      debugRects.push({
        ...stages.renderPrintAreaInAssetSpace,
        stroke: '#ff006e',
        fill: 'rgba(255, 0, 110, 0.12)',
        label: 'renderPrintArea',
      });
    }

    if (stages.effectiveRenderPrintQuadInAssetSpace) {
      debugQuads.push({
        ...stages.effectiveRenderPrintQuadInAssetSpace,
        stroke: '#ffbe0b',
        fill: 'rgba(255, 190, 11, 0.16)',
        label: 'renderPrintQuad',
      });
    }

    if (maskCoverageBounds) {
      debugRects.push({
        ...maskCoverageBounds,
        stroke: '#3a86ff',
        fill: 'rgba(58, 134, 255, 0.10)',
        label: 'mask channel bbox',
      });
    }

    if (occlusionBounds) {
      debugRects.push({
        ...occlusionBounds,
        stroke: '#06d6a0',
        fill: 'rgba(6, 214, 160, 0.14)',
        label: 'occlusion alpha bbox',
      });
    }

    const sceneWithGuides = await annotateBufferWithDebugOverlay(stageBaseBuffer, {
      width: outputWidth,
      height: outputHeight,
      rects: debugRects,
      quads: debugQuads,
    });
    const placedOverScene = await compositeBufferOverBuffer(stageBaseBuffer, stages.placedDesign);
    const maskedOverScene = await compositeBufferOverBuffer(stageBaseBuffer, stages.maskedDesign);
    const warpedOverScene = await compositeBufferOverBuffer(stageBaseBuffer, stages.warpedDesign);
    const clippedOverScene = await compositeBufferOverBuffer(stageBaseBuffer, stages.clippedWarpedDesign);
    const compositeOverScene = await compositeBufferOverBuffer(stageBaseBuffer, stages.designComposite);
    const nextDesignGroupBuffer = await compositeBufferOverBuffer(
      designGroupBuffer,
      stages.designComposite,
      layer.blend || 'over',
    );
    const nextOcclusionGroupBuffer = await compositeAssetOverBuffer(
      occlusionGroupBuffer,
      mergedLayerConfig.assets?.occlusionImageUrl || null,
      outputWidth,
      outputHeight,
      'over',
    );
    const sceneAfterLayer = await compositeBufferOverBuffer(baseBuffer, nextDesignGroupBuffer);
    const sceneAfterOcclusion = await compositeBuffers({
      width: outputWidth,
      height: outputHeight,
      baseBuffer,
      overlays: [
        { input: nextDesignGroupBuffer, blend: 'over' },
        { input: nextOcclusionGroupBuffer, blend: 'over' },
      ],
      format: 'png',
    });

    debugLayers.push({
      index: layerIndex,
      type: 'surface',
      surfaceKey,
      blend: layer.blend || 'over',
      geometry: {
        editorPrintArea: mergedLayerConfig.editorPrintArea,
        sourceCrop: mergedLayerConfig.sourceCrop,
        sourceCropInEditorSpace: stages.sourceCropInEditorSpace,
        renderPrintArea: stages.renderPrintAreaInAssetSpace,
        renderPrintQuad: stages.effectiveRenderPrintQuadInAssetSpace,
        renderPrintQuadBounds: stages.renderPrintQuadBounds,
        rotationDeg: mergedLayerConfig.rotationDeg,
        configuredWidth: mergedLayerConfig.configuredWidth,
        configuredHeight: mergedLayerConfig.configuredHeight,
        designBounds,
        placedBounds,
        maskedBounds,
        warpedBounds,
        clippedBounds,
        compositeBounds,
        maskCoverageBounds,
        occlusionBounds,
        assetUrls: stages.assetUrls,
      },
      stageBuffers: {
        sceneBeforeLayer: stageBaseBuffer,
        sceneWithGuides,
        placedOverScene,
        maskedOverScene,
        warpedOverScene,
        clippedOverScene,
        compositeOverScene,
        sceneAfterLayer,
        sceneAfterOcclusion,
      },
    });

    designGroupBuffer = nextDesignGroupBuffer;
    occlusionGroupBuffer = nextOcclusionGroupBuffer;
  }

  const sceneLightingConfig = resolveSceneLightingConfig(sceneDefinition, template, actualOutputWidth, actualOutputHeight);
  const {
    litDesignGroup,
    shadowOverlay: sceneShadowOverlay,
    highlightOverlay: sceneHighlightOverlay,
  } = await applySceneLightingToDesignGroup({
    designGroupBuffer,
    shadowAssetUrl: sceneLightingConfig.shadowAssetUrl,
    highlightAssetUrl: sceneLightingConfig.highlightAssetUrl,
    blendModes: sceneLightingConfig.blendModes,
    outputWidth,
    outputHeight,
  });
  let composedBuffer = await compositeBuffers({
    width: outputWidth,
    height: outputHeight,
    baseBuffer,
    overlays: [
      { input: litDesignGroup, blend: 'over' },
      { input: occlusionGroupBuffer, blend: 'over' },
    ],
    format: 'png',
  });

  const [sceneShadowBounds, sceneHighlightBounds] = await Promise.all([
    getAlphaBoundsFromBuffer(sceneShadowOverlay, outputWidth, outputHeight),
    getAlphaBoundsFromBuffer(sceneHighlightOverlay, outputWidth, outputHeight),
  ]);

  if (sceneShadowOverlay || sceneHighlightOverlay) {
    debugLayers.push({
      index: sceneDefinition.layers.length,
      type: 'sceneLighting',
      geometry: {
        shadowBounds: sceneShadowBounds,
        highlightBounds: sceneHighlightBounds,
        assetUrls: {
          shadowAssetUrl: sceneLightingConfig.shadowAssetUrl,
          highlightAssetUrl: sceneLightingConfig.highlightAssetUrl,
        },
      },
      stageBuffers: {
        sceneBeforeLighting: await compositeBufferOverBuffer(baseBuffer, designGroupBuffer),
        shadowOverlayOverScene: sceneShadowOverlay
          ? await compositeBufferOverBuffer(baseBuffer, sceneShadowOverlay)
          : null,
        highlightOverlayOverScene: sceneHighlightOverlay
          ? await compositeBufferOverBuffer(baseBuffer, sceneHighlightOverlay)
          : null,
        sceneAfterLighting: composedBuffer,
      },
    });
  }

  for (const deferredOverlayEntry of deferredOverlays) {
    const { overlay, index, type } = deferredOverlayEntry;
    const overlayBounds = await getAssetAlphaBounds(overlay.assetUrl, outputWidth, outputHeight);
    const sceneWithGuides = overlayBounds
      ? await annotateBufferWithDebugOverlay(composedBuffer, {
          width: outputWidth,
          height: outputHeight,
          rects: [
            {
              ...overlayBounds,
              stroke: '#8338ec',
              fill: 'rgba(131, 56, 236, 0.14)',
              label: 'overlay alpha bbox',
            },
          ],
        })
      : composedBuffer;

    composedBuffer = await compositeAssetOverBuffer(
      composedBuffer,
      overlay.assetUrl,
      outputWidth,
      outputHeight,
      overlay.blend || 'over',
    );

    debugLayers.push({
      index,
      type,
      assetUrl: overlay.assetUrl,
      blend: overlay.blend || 'over',
      geometry: {
        overlayBounds,
      },
      stageBuffers: {
        sceneWithGuides,
        sceneAfterOverlay: composedBuffer,
      },
    });
  }

  for (let overlayIndex = 0; overlayIndex < (sceneDefinition.overlays || []).length; overlayIndex += 1) {
    const overlay = sceneDefinition.overlays[overlayIndex];
    if (!overlay?.assetUrl) {
      continue;
    }

    const overlayBounds = await getAssetAlphaBounds(overlay.assetUrl, outputWidth, outputHeight);
    const sceneWithGuides = overlayBounds
      ? await annotateBufferWithDebugOverlay(composedBuffer, {
          width: outputWidth,
          height: outputHeight,
          rects: [
            {
              ...overlayBounds,
              stroke: '#8338ec',
              fill: 'rgba(131, 56, 236, 0.14)',
              label: 'scene overlay alpha bbox',
            },
          ],
        })
      : composedBuffer;

    composedBuffer = await compositeAssetOverBuffer(
      composedBuffer,
      overlay.assetUrl,
      outputWidth,
      outputHeight,
      overlay.blend || 'over',
    );

    debugLayers.push({
      index: sceneDefinition.layers.length + overlayIndex,
      type: 'sceneOverlay',
      assetUrl: overlay.assetUrl,
      blend: overlay.blend || 'over',
      geometry: {
        overlayBounds,
      },
      stageBuffers: {
        sceneWithGuides,
        sceneAfterOverlay: composedBuffer,
      },
    });
  }

  const resized = await resizeFinalBuffer(composedBuffer, outputWidth, outputHeight, null, format);

  return {
    sceneKey,
    surfaceKey: fallbackSurface ? sceneKey : null,
    label: sceneDefinition?.label || sceneKey,
    position: sceneKey,
    mimeType: getMimeTypeForFormat(format),
    width: resized.width,
    height: resized.height,
    buffer: resized.buffer,
    debugStages: null,
    debugScene: {
      baseAssetUrl,
      outputWidth,
      outputHeight,
      layers: debugLayers,
    },
  };
}

async function debugMockupPreview(payload) {
  const template = await getActiveTemplateById(payload.templateId);
  const manifest = await loadMockupManifest(template);
  const colorKey = resolveRequestedColorKey(template, payload, manifest);
  const format = normalizeFormat(payload.format || template.defaultRenderOptions?.format || 'png');
  const requestedSize = Number(payload.size || template.defaultRenderOptions?.size || 2048);
  const surfacePayloads = collectSurfacePayloadsFromPayload(template, payload);
  const sceneKeys = resolveRequestedSceneKeys(template, payload);

  const previews = [];

  for (const sceneKey of sceneKeys) {
    const sceneDefinition = getSceneDefinition(template, manifest, sceneKey);
    const preview = await debugRenderScenePreview({
      template,
      sceneKey,
      sceneDefinition,
      surfacePayloads,
      colorKey,
      manifest,
      format,
      requestedSize,
    });

    previews.push(preview);
  }

  return {
    templateId: template._id.toString(),
    colorKey,
    format,
    previews,
  };
}

async function renderMockupPreview(payload) {
  const template = await getActiveTemplateById(payload.templateId);
  const manifest = await loadMockupManifest(template);
  const colorKey = resolveRequestedColorKey(template, payload, manifest);
  const format = normalizeFormat(payload.format || template.defaultRenderOptions?.format || 'png');
  const requestedSize = Number(payload.size || template.defaultRenderOptions?.size || 2048);
  const debugEnabled = Boolean(payload.debug) || (Array.isArray(payload.debugStages) && payload.debugStages.length > 0);
  const debugStageKeys = normalizeDebugStageKeys(payload.debugStages);
  const surfacePayloads = collectSurfacePayloadsFromPayload(template, payload);
  const sceneKeys = resolveRequestedSceneKeys(template, payload);

  const previews = [];

  for (const sceneKey of sceneKeys) {
    const sceneDefinition = getSceneDefinition(template, manifest, sceneKey);
    const preview = await renderScenePreview({
      template,
      sceneKey,
      sceneDefinition,
      surfacePayloads,
      colorKey,
      manifest,
      format,
      requestedSize,
    });

    previews.push(preview);
  }

  if (payload.responseType === 'binary') {
    if (previews.length !== 1) {
      throw new ApiError(422, 'Binary response requires exactly one rendered scene');
    }

    return previews[0];
  }

  return {
    templateId: template._id.toString(),
    colorKey,
    format,
    previews: previews.map((preview) => ({
      sceneKey: preview.sceneKey,
      surfaceKey: preview.surfaceKey,
      label: preview.label,
      position: preview.position,
      mimeType: preview.mimeType,
      width: preview.width,
      height: preview.height,
      dataUrl: bufferToDataUrl(preview.buffer, preview.mimeType),
      debug: preview.debugStages
        ? {
            stages: preview.debugStages,
          }
        : undefined,
    })),
  };
}

module.exports = {
  debugMockupPreview,
  renderMockupPreview,
};
