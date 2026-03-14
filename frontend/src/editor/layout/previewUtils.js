import { StaticCanvas } from 'fabric';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const DEFAULT_VIEWBOX = { width: 3568.58, height: 3568.58 };

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
    const cleaned = String(hex || '').replace('#', '').trim();
    const full = cleaned.length === 3
        ? cleaned.split('').map((char) => char + char).join('')
        : cleaned.padEnd(6, '0').slice(0, 6);
    const parsed = Number.parseInt(full, 16);

    return {
        r: (parsed >> 16) & 255,
        g: (parsed >> 8) & 255,
        b: parsed & 255,
    };
}

function rgbToHex({ r, g, b }) {
    return `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function mixColor(baseHex, mixHex, amount) {
    const safeAmount = clamp(amount, 0, 1);
    const base = hexToRgb(baseHex);
    const mix = hexToRgb(mixHex);

    return rgbToHex({
        r: base.r + (mix.r - base.r) * safeAmount,
        g: base.g + (mix.g - base.g) * safeAmount,
        b: base.b + (mix.b - base.b) * safeAmount,
    });
}

function setSvgHref(node, value) {
    if (!node || !value) return;
    node.setAttribute('href', value);
    node.setAttributeNS(XLINK_NS, 'xlink:href', value);
}

function parseViewBox(svgEl) {
    const raw = svgEl?.getAttribute('viewBox');
    if (!raw) return DEFAULT_VIEWBOX;

    const values = raw.trim().split(/[\s,]+/).map(Number);
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return DEFAULT_VIEWBOX;

    return { width: values[2], height: values[3] };
}

function getPlaceholderSize(placeholder) {
    if (!placeholder) return { width: 0, height: 0 };

    const width = Number.parseFloat(placeholder.getAttribute('width') || '')
        || placeholder.viewBox?.baseVal?.width
        || 0;
    const height = Number.parseFloat(placeholder.getAttribute('height') || '')
        || placeholder.viewBox?.baseVal?.height
        || 0;

    return { width, height };
}

function extractPrintAreaFromSvg(svgEl, surface) {
    if (!svgEl || !surface) return null;

    const placeholder = svgEl.querySelector(`#placeholder_${surface}`);
    if (!placeholder) return null;

    const { width, height } = getPlaceholderSize(placeholder);
    let x = Number.parseFloat(placeholder.getAttribute('x') || '') || 0;
    let y = Number.parseFloat(placeholder.getAttribute('y') || '') || 0;

    const parent = placeholder.parentElement;
    const transform = parent?.getAttribute('transform') || '';
    const match = transform.match(/translate\(\s*([-\d.+eE]+)(?:[\s,]+([-\d.+eE]+))?\s*\)/);
    if (match) {
        x = Number.parseFloat(match[1]) || x;
        y = Number.parseFloat(match[2] || '0') || y;
    }

    if (width <= 0 || height <= 0) return null;
    return { x, y, width, height };
}

function createFabricTextureDataUrl(baseColor) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const lighter = mixColor(baseColor, '#ffffff', 0.18);
    const darker = mixColor(baseColor, '#000000', 0.12);
    const deepest = mixColor(baseColor, '#000000', 0.2);

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = lighter;
    ctx.lineWidth = 1;
    for (let offset = -size; offset < size * 2; offset += 9) {
        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset + size, size);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.strokeStyle = darker;
    ctx.lineWidth = 1;
    for (let offset = -size; offset < size * 2; offset += 10) {
        ctx.beginPath();
        ctx.moveTo(offset, size);
        ctx.lineTo(offset + size, 0);
        ctx.stroke();
    }
    ctx.restore();

    const imageData = ctx.getImageData(0, 0, size, size);
    const { data } = imageData;
    for (let index = 0; index < data.length; index += 4) {
        const variance = Math.round((Math.random() - 0.5) * 18);
        data[index] = clamp(data[index] + variance, 0, 255);
        data[index + 1] = clamp(data[index + 1] + variance, 0, 255);
        data[index + 2] = clamp(data[index + 2] + variance, 0, 255);
    }
    ctx.putImageData(imageData, 0, 0);

    const vignette = ctx.createRadialGradient(size * 0.5, size * 0.42, size * 0.1, size * 0.5, size * 0.42, size * 0.8);
    vignette.addColorStop(0, 'rgba(255,255,255,0.14)');
    vignette.addColorStop(0.55, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = deepest;
    for (let y = 0; y < size; y += 12) {
        ctx.fillRect(0, y, size, 1);
    }
    ctx.restore();

    return canvas.toDataURL('image/png');
}

function addPreviewDefs(defs, surface) {
    const ids = {
        warpId: `preview-warp-${surface}`,
        shadowId: `preview-shadow-${surface}`,
        textureId: `preview-texture-${surface}`,
        sheenId: `preview-sheen-${surface}`,
    };

    if (!defs) return ids;

    defs.insertAdjacentHTML('beforeend', `
        <filter id="${ids.shadowId}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
            <feOffset in="SourceAlpha" dx="10" dy="12" result="offset" />
            <feGaussianBlur in="offset" stdDeviation="14" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.04 0 0 0 0 0.05 0 0 0 0 0.08 0 0 0 0.32 0" />
        </filter>
        <filter id="${ids.warpId}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves="2" seed="${surface === 'front' ? 13 : 19}" stitchTiles="stitch" result="noise" />
            <feGaussianBlur in="noise" stdDeviation="0.45" result="softNoise" />
            <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="20" xChannelSelector="R" yChannelSelector="G" result="warped" />
            <feGaussianBlur in="warped" stdDeviation="0.18" result="softened" />
            <feColorMatrix in="softened" type="saturate" values="0.95" result="ink" />
            <feComponentTransfer in="ink">
                <feFuncA type="table" tableValues="0 0.97" />
            </feComponentTransfer>
        </filter>
        <filter id="${ids.textureId}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="${surface === 'front' ? 23 : 29}" stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="monoNoise" />
            <feComponentTransfer in="monoNoise" result="grain">
                <feFuncR type="gamma" amplitude="1.2" exponent="0.82" offset="0" />
                <feFuncG type="gamma" amplitude="1.2" exponent="0.82" offset="0" />
                <feFuncB type="gamma" amplitude="1.2" exponent="0.82" offset="0" />
                <feFuncA type="table" tableValues="0 0.15" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="grain" mode="soft-light" />
        </filter>
        <linearGradient id="${ids.sheenId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.24" />
            <stop offset="38%" stop-color="#ffffff" stop-opacity="0" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0.12" />
        </linearGradient>
    `);

    return ids;
}

function injectDesignIntoSvg(svgEl, {
    surface,
    designDataUrl,
    shirtColor,
    printArea,
    sceneSize,
}) {
    const defs = svgEl.querySelector('defs');
    const placeholder = svgEl.querySelector(`#placeholder_${surface}`);
    if (!placeholder) return;

    const { width, height } = getPlaceholderSize(placeholder);
    const ids = addPreviewDefs(defs, surface);

    const colorLayer = svgEl.querySelector('#color_first');
    if (colorLayer) colorLayer.setAttribute('fill', shirtColor || '#FFFFFF');

    const fabricImage = svgEl.querySelector('#fabric-image');
    if (fabricImage) {
        setSvgHref(fabricImage, createFabricTextureDataUrl(shirtColor || '#FFFFFF'));
        fabricImage.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    }

    while (placeholder.firstChild) placeholder.removeChild(placeholder.firstChild);
    placeholder.setAttribute('overflow', 'hidden');

    if (!designDataUrl || width <= 0 || height <= 0) return;

    const createImageNode = () => {
        const node = document.createElementNS(SVG_NS, 'image');
        node.setAttribute('x', String(-(Number(printArea?.x) || 0)));
        node.setAttribute('y', String(-(Number(printArea?.y) || 0)));
        node.setAttribute('width', String(sceneSize.width));
        node.setAttribute('height', String(sceneSize.height));
        node.setAttribute('preserveAspectRatio', 'none');
        setSvgHref(node, designDataUrl);
        return node;
    };

    const shadowImage = createImageNode();
    shadowImage.setAttribute('filter', `url(#${ids.shadowId})`);
    shadowImage.setAttribute('opacity', '0.24');

    const designImage = createImageNode();
    designImage.setAttribute('filter', `url(#${ids.warpId})`);
    designImage.setAttribute('opacity', '0.98');

    const textureOverlay = document.createElementNS(SVG_NS, 'rect');
    textureOverlay.setAttribute('x', '0');
    textureOverlay.setAttribute('y', '0');
    textureOverlay.setAttribute('width', String(width));
    textureOverlay.setAttribute('height', String(height));
    textureOverlay.setAttribute('fill', '#ffffff');
    textureOverlay.setAttribute('opacity', '0.12');
    textureOverlay.setAttribute('filter', `url(#${ids.textureId})`);

    const sheenOverlay = document.createElementNS(SVG_NS, 'rect');
    sheenOverlay.setAttribute('x', '0');
    sheenOverlay.setAttribute('y', '0');
    sheenOverlay.setAttribute('width', String(width));
    sheenOverlay.setAttribute('height', String(height));
    sheenOverlay.setAttribute('fill', `url(#${ids.sheenId})`);
    sheenOverlay.setAttribute('opacity', '0.18');

    placeholder.appendChild(shadowImage);
    placeholder.appendChild(designImage);
    placeholder.appendChild(textureOverlay);
    placeholder.appendChild(sheenOverlay);
}

async function renderDesignDataUrl(snapshot, sceneSize) {
    if (!snapshot || !sceneSize) return null;

    const width = Math.max(1, Math.round(Number(sceneSize.width) || 0));
    const height = Math.max(1, Math.round(Number(sceneSize.height) || 0));
    if (width <= 0 || height <= 0) return null;

    const canvas = new StaticCanvas(undefined, {
        width,
        height,
        backgroundColor: 'rgba(0,0,0,0)',
        enableRetinaScaling: false,
        renderOnAddRemove: false,
    });

    try {
        await canvas.loadFromJSON(snapshot);
        canvas.requestRenderAll();
        return canvas.toDataURL({
            format: 'png',
            multiplier: 1,
            enableRetinaScaling: false,
        });
    } finally {
        canvas.dispose();
    }
}

function serializeSvg(svgEl) {
    return new XMLSerializer().serializeToString(svgEl);
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new window.Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load preview image'));
        image.src = src;
    });
}

export async function buildSurfacePreview({
    surface,
    svgText,
    snapshot,
    printArea,
    shirtColor,
}) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) throw new Error(`Missing SVG root for ${surface}`);

    const sceneSize = parseViewBox(svgEl);
    const effectivePrintArea = extractPrintAreaFromSvg(svgEl, surface) || printArea;
    const designDataUrl = await renderDesignDataUrl(snapshot, sceneSize);
    injectDesignIntoSvg(svgEl, {
        surface,
        designDataUrl,
        shirtColor,
        printArea: effectivePrintArea,
        sceneSize,
    });

    const { width, height } = sceneSize;

    return {
        svgMarkup: serializeSvg(svgEl),
        width,
        height,
    };
}

export function createSvgObjectUrl(svgMarkup) {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    return URL.createObjectURL(blob);
}

export async function rasterizePreviewSvg(svgMarkup, { width, height, maxDimension = 3000 } = {}) {
    const svgUrl = createSvgObjectUrl(svgMarkup);

    try {
        const image = await loadImage(svgUrl);
        const sourceWidth = Math.max(1, Math.round(width || image.naturalWidth || DEFAULT_VIEWBOX.width));
        const sourceHeight = Math.max(1, Math.round(height || image.naturalHeight || DEFAULT_VIEWBOX.height));
        const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
        const outWidth = Math.max(1, Math.round(sourceWidth * scale));
        const outHeight = Math.max(1, Math.round(sourceHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = outWidth;
        canvas.height = outHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to create export canvas');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, outWidth, outHeight);

        return canvas.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}
