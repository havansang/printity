const fs = require('fs/promises');
const path = require('path');

const sharp = require('sharp');

const ApiError = require('../../utils/ApiError');
const { SURFACE_KEYS } = require('../../constants/product');
const { getUploadRootAbsolutePath } = require('../../utils/file');
const { getTextToSvg } = require('../fonts/font.service');
const { getActiveTemplateById } = require('../templates/template.service');

const MOCKUP_ROOT = path.resolve(process.cwd(), 'resources', 'mockups');
const LOCAL_ASSET_CACHE = new Map();
const FORMAT_ALIASES = {
  jpg: 'jpeg',
};

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

function resolveRenderPrintAreaSpace({
  printArea,
  configuredWidth,
  configuredHeight,
  actualWidth,
  actualHeight,
}) {
  const normalizedPrintArea = normalizeRect(printArea);

  if (fitsWithinBounds(normalizedPrintArea, actualWidth, actualHeight)) {
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

function getLocalAbsolutePathFromPublicUrl(assetUrl) {
  const normalizedUrl = String(assetUrl || '').trim();
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
      return LOCAL_ASSET_CACHE.get(localAbsolutePath);
    }

    const buffer = await fs.readFile(localAbsolutePath);
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

async function loadAssetDataUrl(assetUrl, hintedMimeType = null) {
  const asset = await loadAssetBuffer(assetUrl, hintedMimeType);
  if (!asset) {
    return null;
  }

  return bufferToDataUrl(asset.buffer, asset.mimeType);
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

async function createBlankPng(width, height) {
  return createTransparentCanvas(width, height);
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

  return sharp(await createBlankPng(outputWidth, outputHeight))
    .composite([
      {
        input: resizedDesign,
        left,
        top,
      },
    ])
    .png()
    .toBuffer();
}

async function applyMaskBuffer(sourceBuffer, maskAssetUrl, width, height) {
  if (!maskAssetUrl) {
    return sourceBuffer;
  }

  const [{ data: sourceData, info }, maskChannel] = await Promise.all([
    sharp(sourceBuffer)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp((await loadAssetBuffer(maskAssetUrl)).buffer)
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

  const { data, info } = await sharp((await loadAssetBuffer(assetUrl)).buffer)
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
  const { data, info } = await sharp((await loadAssetBuffer(assetUrl)).buffer)
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
  if (!layer.src) {
    return '';
  }

  const hintedMimeType = layer.sourceMimeType || layer.type || null;
  const href = await loadAssetDataUrl(layer.src, hintedMimeType);

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
  const x = Number.isFinite(Number(layer?.x)) ? Number(layer.x) : 0.5;
  const y = Number.isFinite(Number(layer?.y)) ? Number(layer.y) : 0.5;
  const angle = Number.isFinite(Number(layer?.angle)) ? Number(layer.angle) : 0;
  const scale = Number.isFinite(Number(layer?.scale)) && Number(layer.scale) > 0 ? Number(layer.scale) : 1;
  const baseWidth = Number.isFinite(Number(layer?.width)) && Number(layer.width) > 0 ? Number(layer.width) : 100;
  const baseHeight = Number.isFinite(Number(layer?.height)) && Number(layer.height) > 0 ? Number(layer.height) : 100;
  const centerX = x * placeholderWidth;
  const centerY = y * placeholderHeight;
  const scaleX = (layer?.flipX ? -1 : 1) * scale;
  const scaleY = (layer?.flipY ? -1 : 1) * scale;

  let innerMarkup = '';

  if (layerType === 'image') {
    innerMarkup = await buildImageLayerMarkup(layer, baseWidth, baseHeight);
  } else if (layerType === 'shape') {
    innerMarkup = buildShapeLayerMarkup(layer, baseWidth, baseHeight);
  } else if (layerType === 'text' || layerType === 'careset' || layerType === 'text_layer') {
    innerMarkup = await buildTextLayerMarkup(layer, baseWidth, baseHeight);
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
  const displacementDataUrl = await loadAssetDataUrl(displacementAssetUrl);
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

  const overlay = await rasterizeAssetToPng(assetUrl, width, height);
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

async function renderSurfacePreview({
  template,
  surfaceKey,
  surfacePayload,
  format,
  requestedSize,
}) {
  const surface = template.surfaces?.[surfaceKey];
  if (!surface) {
    throw new ApiError(404, `Surface ${surfaceKey} not found in template`);
  }

  const editorPrintArea = getEditorPrintArea(surface);
  const renderPrintArea = getRenderPrintArea(surface);
  const baseAssetUrl = surface.render?.baseImageUrl || surface.templateImageUrl;
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
  const maskedDesign = await applyMaskBuffer(placedDesign, maskAssetUrl, outputWidth, outputHeight);
  const warpedDesign = await warpDesignBuffer(
    maskedDesign,
    outputWidth,
    outputHeight,
    displacementAssetUrl,
    surface.render?.displacement || {},
  );
  const clippedWarpedDesign = await applyMaskBuffer(warpedDesign, maskAssetUrl, outputWidth, outputHeight);
  const shadowOverlay = await maskOverlayBySourceAlpha(
    await buildShadowOverlay(shadowAssetUrl, outputWidth, outputHeight),
    clippedWarpedDesign,
    outputWidth,
    outputHeight,
  );
  const shadowedDesign = shadowOverlay
    ? await sharp(clippedWarpedDesign)
        .composite([
          {
            input: shadowOverlay,
            blend: surface.render?.blendModes?.shadow || 'multiply',
          },
        ])
        .png()
        .toBuffer()
    : clippedWarpedDesign;
  const highlightOverlay = await maskOverlayBySourceAlpha(
    await buildHighlightOverlay(highlightAssetUrl, outputWidth, outputHeight),
    clippedWarpedDesign,
    outputWidth,
    outputHeight,
  );
  const designComposite = highlightOverlay
    ? await sharp(shadowedDesign)
        .composite([
          {
            input: highlightOverlay,
            blend: surface.render?.blendModes?.highlight || 'screen',
          },
        ])
        .png()
        .toBuffer()
    : shadowedDesign;

  const baseBuffer = await rasterizeAssetToPng(baseAssetUrl, outputWidth, outputHeight);
  const mergedBuffer = await compositeBuffers({
    width: outputWidth,
    height: outputHeight,
    baseBuffer,
    overlays: [{ input: designComposite, blend: 'over' }],
    format,
  });

  const resized = await resizeFinalBuffer(mergedBuffer, outputWidth, outputHeight, null, format);

  return {
    surfaceKey,
    position: surface.position || (surfaceKey === 'neckLabelInner' ? 'neck' : surfaceKey),
    mimeType: getMimeTypeForFormat(format),
    width: resized.width,
    height: resized.height,
    buffer: resized.buffer,
  };
}

async function renderMockupPreview(payload) {
  const template = await getActiveTemplateById(payload.templateId);
  const format = normalizeFormat(payload.format || template.defaultRenderOptions?.format || 'png');
  const requestedSize = Number(payload.size || template.defaultRenderOptions?.size || 2048);
  const surfacePayloads = collectSurfacePayloads(template, payload.print);
  const surfaceKeys = resolveRequestedSurfaceKeys(template, payload.print, payload.surfaceKey);

  const previews = [];

  for (const surfaceKey of surfaceKeys) {
    const preview = await renderSurfacePreview({
      template,
      surfaceKey,
      surfacePayload: surfacePayloads.get(surfaceKey) || { images: [] },
      format,
      requestedSize,
    });

    previews.push(preview);
  }

  if (payload.responseType === 'binary') {
    if (previews.length !== 1) {
      throw new ApiError(422, 'Binary response requires exactly one rendered surface');
    }

    return previews[0];
  }

  return {
    templateId: template._id.toString(),
    format,
    previews: previews.map((preview) => ({
      surfaceKey: preview.surfaceKey,
      position: preview.position,
      mimeType: preview.mimeType,
      width: preview.width,
      height: preview.height,
      dataUrl: bufferToDataUrl(preview.buffer, preview.mimeType),
    })),
  };
}

module.exports = {
  renderMockupPreview,
};
