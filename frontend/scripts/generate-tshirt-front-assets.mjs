import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(frontendRoot, 'public', 'front.svg');
const outputDir = path.join(frontendRoot, 'public', 'assets', 'basic-tee-white');

function mustMatch(text, pattern, label) {
    const match = text.match(pattern);
    if (!match) throw new Error(`Could not extract ${label} from front.svg`);
    return match;
}

function round(value) {
    return Number(Number(value).toFixed(2));
}

function formatNumber(value) {
    const rounded = round(value);
    if (Number.isInteger(rounded)) return String(rounded);
    return String(rounded);
}

function svgDocument(viewBox, content) {
    return [
        '<svg xmlns="http://www.w3.org/2000/svg"',
        `  viewBox="${viewBox}"`,
        '  width="100%"',
        '  height="100%">',
        content.trimEnd(),
        '</svg>',
        '',
    ].join('\n');
}

function rectPath(x, y, width, height, radius) {
    const right = x + width;
    const bottom = y + height;
    const r = Math.min(radius, width / 2, height / 2);

    return [
        `M ${formatNumber(x + r)} ${formatNumber(y)}`,
        `H ${formatNumber(right - r)}`,
        `A ${formatNumber(r)} ${formatNumber(r)} 0 0 1 ${formatNumber(right)} ${formatNumber(y + r)}`,
        `V ${formatNumber(bottom - r)}`,
        `A ${formatNumber(r)} ${formatNumber(r)} 0 0 1 ${formatNumber(right - r)} ${formatNumber(bottom)}`,
        `H ${formatNumber(x + r)}`,
        `A ${formatNumber(r)} ${formatNumber(r)} 0 0 1 ${formatNumber(x)} ${formatNumber(bottom - r)}`,
        `V ${formatNumber(y + r)}`,
        `A ${formatNumber(r)} ${formatNumber(r)} 0 0 1 ${formatNumber(x + r)} ${formatNumber(y)}`,
        'Z',
    ].join(' ');
}

async function main() {
    const svgText = await readFile(sourcePath, 'utf8');

    const viewBox = mustMatch(svgText, /viewBox="([^"]+)"/, 'viewBox')[1];
    const viewBoxParts = viewBox.split(/\s+/).map(Number);
    const [, , viewWidth, viewHeight] = viewBoxParts;

    const fabricPath = mustMatch(svgText, /<path d="([^"]+)" id="fabric-0"\/>/, 'fabric path')[1];
    const collarPath = mustMatch(svgText, /<g id="shadows">\s*(<path[\s\S]*?\/>)\s*<\/g>/, 'collar shadow path')[1];
    const collarPathD = mustMatch(collarPath, /d="([^"]+)"/, 'collar shadow d')[1];
    const outlinesContent = mustMatch(svgText, /<g id="outlines_colored">([\s\S]*?)<\/g>/, 'outline group')[1].trim();
    const collarOutlineTags = Array.from(outlinesContent.matchAll(/<path[\s\S]*?\/>/g))
        .slice(0, 5)
        .map((match) => match[0])
        .join('\n      ');

    const printAreaMatch = mustMatch(
        svgText,
        /transform="translate\(([-\d.]+)\s+([-\d.]+)\)"[^>]*>\s*<svg[^>]*id="placeholder_front"[^>]*width="([-\d.]+)"[^>]*height="([-\d.]+)"/,
        'print area'
    );

    const printX = Number(printAreaMatch[1]);
    const printY = Number(printAreaMatch[2]);
    const printWidth = Number(printAreaMatch[3]);
    const printHeight = Number(printAreaMatch[4]);
    const printRadius = round(Math.min(printWidth, printHeight) * 0.04);
    const safeInsetX = round(printWidth * 0.08);
    const safeInsetY = round(printHeight * 0.08);
    const bleed = 36;

    const printRight = round(printX + printWidth);
    const printBottom = round(printY + printHeight);
    const centerX = round(printX + printWidth / 2);
    const centerY = round(printY + printHeight / 2);
    const printAreaPath = rectPath(printX, printY, printWidth, printHeight, printRadius);

    const baseSvg = svgDocument(viewBox, `
  <defs>
    <path id="tee-shape" d="${fabricPath}" />
    <clipPath id="tee-clip">
      <use href="#tee-shape" />
    </clipPath>
    <linearGradient id="tee-fill" x1="12%" y1="8%" x2="88%" y2="94%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="52%" stop-color="#f6f6f6" />
      <stop offset="100%" stop-color="#ececec" />
    </linearGradient>
    <radialGradient id="tee-bloom" cx="36%" cy="18%" r="72%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.72" />
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="tee-depth" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.02" />
      <stop offset="55%" stop-color="#000000" stop-opacity="0" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.08" />
    </linearGradient>
  </defs>
  <g id="base">
    <use href="#tee-shape" fill="url(#tee-fill)" />
    <g clip-path="url(#tee-clip)">
      <rect width="${formatNumber(viewWidth)}" height="${formatNumber(viewHeight)}" fill="url(#tee-bloom)" />
      <rect width="${formatNumber(viewWidth)}" height="${formatNumber(viewHeight)}" fill="url(#tee-depth)" />
    </g>
  </g>
  <g id="base-collar-shadow">
    ${collarPath}
  </g>
  <g id="base-outlines">
    ${outlinesContent}
  </g>`);

    const maskSvg = svgDocument(viewBox, `
  <rect width="${formatNumber(viewWidth)}" height="${formatNumber(viewHeight)}" fill="#000000" />
  <path d="${printAreaPath}" fill="#ffffff" />
  <path d="${collarPathD}" fill="#000000" />
`);

    const shadowSvg = svgDocument(viewBox, `
  <defs>
    <path id="print-area-path" d="${printAreaPath}" />
    <clipPath id="print-area-clip">
      <use href="#print-area-path" />
    </clipPath>
    <filter id="shadow-blur" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="34" />
    </filter>
    <linearGradient id="shadow-side" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.28" />
      <stop offset="16%" stop-color="#000000" stop-opacity="0.08" />
      <stop offset="50%" stop-color="#000000" stop-opacity="0" />
      <stop offset="84%" stop-color="#000000" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.28" />
    </linearGradient>
    <linearGradient id="shadow-top" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.16" />
      <stop offset="22%" stop-color="#000000" stop-opacity="0.03" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="shadow-belly" cx="50%" cy="48%" r="62%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.14" />
      <stop offset="55%" stop-color="#000000" stop-opacity="0.04" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>
  <g clip-path="url(#print-area-clip)">
    <rect x="${formatNumber(printX)}" y="${formatNumber(printY)}" width="${formatNumber(printWidth)}" height="${formatNumber(printHeight)}" fill="url(#shadow-side)" />
    <rect x="${formatNumber(printX)}" y="${formatNumber(printY)}" width="${formatNumber(printWidth)}" height="${formatNumber(printHeight)}" fill="url(#shadow-top)" />
    <ellipse cx="${formatNumber(centerX)}" cy="${formatNumber(printY + printHeight * 0.44)}" rx="${formatNumber(printWidth * 0.42)}" ry="${formatNumber(printHeight * 0.18)}" fill="url(#shadow-belly)" />
    <path d="M ${formatNumber(printX + printWidth * 0.2)} ${formatNumber(printY - printHeight * 0.02)} C ${formatNumber(printX + printWidth * 0.08)} ${formatNumber(printY + printHeight * 0.18)}, ${formatNumber(printX + printWidth * 0.14)} ${formatNumber(printY + printHeight * 0.58)}, ${formatNumber(printX + printWidth * 0.28)} ${formatNumber(printBottom)}" fill="none" stroke="#000000" stroke-opacity="0.16" stroke-width="${formatNumber(printWidth * 0.08)}" stroke-linecap="round" filter="url(#shadow-blur)" />
    <path d="M ${formatNumber(printX + printWidth * 0.8)} ${formatNumber(printY - printHeight * 0.01)} C ${formatNumber(printX + printWidth * 0.9)} ${formatNumber(printY + printHeight * 0.2)}, ${formatNumber(printX + printWidth * 0.84)} ${formatNumber(printY + printHeight * 0.6)}, ${formatNumber(printX + printWidth * 0.72)} ${formatNumber(printBottom)}" fill="none" stroke="#000000" stroke-opacity="0.18" stroke-width="${formatNumber(printWidth * 0.08)}" stroke-linecap="round" filter="url(#shadow-blur)" />
    <path d="M ${formatNumber(printX + printWidth * 0.36)} ${formatNumber(printBottom - printHeight * 0.08)} C ${formatNumber(centerX)} ${formatNumber(printBottom + printHeight * 0.03)}, ${formatNumber(printX + printWidth * 0.62)} ${formatNumber(printBottom - printHeight * 0.1)}, ${formatNumber(printRight - printWidth * 0.08)} ${formatNumber(printBottom - printHeight * 0.04)}" fill="none" stroke="#000000" stroke-opacity="0.1" stroke-width="${formatNumber(printHeight * 0.06)}" stroke-linecap="round" filter="url(#shadow-blur)" />
  </g>
  <path d="${collarPathD}" fill="#000000" fill-opacity="0.18" />
`);

    const highlightSvg = svgDocument(viewBox, `
  <defs>
    <path id="print-area-path" d="${printAreaPath}" />
    <clipPath id="print-area-clip">
      <use href="#print-area-path" />
    </clipPath>
    <filter id="highlight-blur" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="28" />
    </filter>
    <linearGradient id="highlight-sweep" x1="12%" y1="6%" x2="88%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.34" />
      <stop offset="32%" stop-color="#ffffff" stop-opacity="0.14" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="highlight-left" cx="26%" cy="18%" r="44%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.52" />
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="highlight-right" cx="84%" cy="22%" r="38%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22" />
      <stop offset="65%" stop-color="#ffffff" stop-opacity="0.04" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
  </defs>
  <g clip-path="url(#print-area-clip)">
    <rect x="${formatNumber(printX)}" y="${formatNumber(printY)}" width="${formatNumber(printWidth)}" height="${formatNumber(printHeight)}" fill="url(#highlight-sweep)" />
    <ellipse cx="${formatNumber(printX + printWidth * 0.28)}" cy="${formatNumber(printY + printHeight * 0.18)}" rx="${formatNumber(printWidth * 0.33)}" ry="${formatNumber(printHeight * 0.18)}" fill="url(#highlight-left)" filter="url(#highlight-blur)" />
    <ellipse cx="${formatNumber(printX + printWidth * 0.82)}" cy="${formatNumber(printY + printHeight * 0.16)}" rx="${formatNumber(printWidth * 0.2)}" ry="${formatNumber(printHeight * 0.14)}" fill="url(#highlight-right)" filter="url(#highlight-blur)" />
    <path d="M ${formatNumber(printX + printWidth * 0.22)} ${formatNumber(printY + printHeight * 0.26)} C ${formatNumber(printX + printWidth * 0.42)} ${formatNumber(printY + printHeight * 0.2)}, ${formatNumber(printX + printWidth * 0.56)} ${formatNumber(printY + printHeight * 0.12)}, ${formatNumber(printX + printWidth * 0.74)} ${formatNumber(printY + printHeight * 0.18)}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="${formatNumber(printWidth * 0.06)}" stroke-linecap="round" filter="url(#highlight-blur)" />
    <path d="M ${formatNumber(printX + printWidth * 0.4)} ${formatNumber(printY + printHeight * 0.54)} C ${formatNumber(centerX)} ${formatNumber(printY + printHeight * 0.46)}, ${formatNumber(printX + printWidth * 0.62)} ${formatNumber(printY + printHeight * 0.52)}, ${formatNumber(printX + printWidth * 0.74)} ${formatNumber(printY + printHeight * 0.48)}" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="${formatNumber(printWidth * 0.08)}" stroke-linecap="round" filter="url(#highlight-blur)" />
  </g>
`);

    const collarSvg = svgDocument(viewBox, `
  <defs>
    <linearGradient id="collar-fill" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#fdfdfd" />
      <stop offset="100%" stop-color="#ededed" />
    </linearGradient>
    <filter id="collar-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="10" />
    </filter>
  </defs>
  <path d="${collarPathD}" fill="url(#collar-fill)" />
  <path d="${collarPathD}" fill="#000000" fill-opacity="0.12" filter="url(#collar-soft-shadow)" />
  <g id="collar-seams">
      ${collarOutlineTags}
  </g>
`);

    const displacementSvg = svgDocument(viewBox, `
  <defs>
    <path id="print-area-path" d="${printAreaPath}" />
    <clipPath id="print-area-clip">
      <use href="#print-area-path" />
    </clipPath>
    <filter id="disp-blur" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="30" />
    </filter>
  </defs>
  <rect width="${formatNumber(viewWidth)}" height="${formatNumber(viewHeight)}" fill="#808080" />
  <g clip-path="url(#print-area-clip)">
    <rect x="${formatNumber(printX)}" y="${formatNumber(printY)}" width="${formatNumber(printWidth)}" height="${formatNumber(printHeight)}" fill="#808080" />
    <path d="M ${formatNumber(printX + printWidth * 0.18)} ${formatNumber(printY)} C ${formatNumber(printX + printWidth * 0.12)} ${formatNumber(printY + printHeight * 0.22)}, ${formatNumber(printX + printWidth * 0.12)} ${formatNumber(printY + printHeight * 0.58)}, ${formatNumber(printX + printWidth * 0.24)} ${formatNumber(printBottom)}" fill="none" stroke="#6f6f6f" stroke-opacity="0.32" stroke-width="${formatNumber(printWidth * 0.1)}" stroke-linecap="round" filter="url(#disp-blur)" />
    <path d="M ${formatNumber(printX + printWidth * 0.82)} ${formatNumber(printY)} C ${formatNumber(printX + printWidth * 0.88)} ${formatNumber(printY + printHeight * 0.26)}, ${formatNumber(printX + printWidth * 0.88)} ${formatNumber(printY + printHeight * 0.58)}, ${formatNumber(printX + printWidth * 0.74)} ${formatNumber(printBottom)}" fill="none" stroke="#929292" stroke-opacity="0.26" stroke-width="${formatNumber(printWidth * 0.1)}" stroke-linecap="round" filter="url(#disp-blur)" />
    <path d="M ${formatNumber(printX + printWidth * 0.5)} ${formatNumber(printY + printHeight * 0.12)} C ${formatNumber(printX + printWidth * 0.44)} ${formatNumber(printY + printHeight * 0.32)}, ${formatNumber(printX + printWidth * 0.54)} ${formatNumber(printY + printHeight * 0.68)}, ${formatNumber(printX + printWidth * 0.48)} ${formatNumber(printBottom - printHeight * 0.02)}" fill="none" stroke="#777777" stroke-opacity="0.18" stroke-width="${formatNumber(printWidth * 0.06)}" stroke-linecap="round" filter="url(#disp-blur)" />
    <ellipse cx="${formatNumber(printX + printWidth * 0.32)}" cy="${formatNumber(printY + printHeight * 0.28)}" rx="${formatNumber(printWidth * 0.14)}" ry="${formatNumber(printHeight * 0.12)}" fill="#8d8d8d" fill-opacity="0.14" filter="url(#disp-blur)" />
    <ellipse cx="${formatNumber(printX + printWidth * 0.7)}" cy="${formatNumber(printY + printHeight * 0.62)}" rx="${formatNumber(printWidth * 0.16)}" ry="${formatNumber(printHeight * 0.14)}" fill="#757575" fill-opacity="0.18" filter="url(#disp-blur)" />
  </g>
`);

    const fabricGrainSvg = svgDocument(viewBox, `
  <defs>
    <path id="print-area-path" d="${printAreaPath}" />
    <clipPath id="print-area-clip">
      <use href="#print-area-path" />
    </clipPath>
    <filter id="grain-noise" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="2" seed="17" stitchTiles="stitch" result="noise" />
      <feColorMatrix in="noise" type="saturate" values="0" result="monoNoise" />
      <feComponentTransfer in="monoNoise" result="grain">
        <feFuncR type="gamma" amplitude="1.08" exponent="0.88" offset="0" />
        <feFuncG type="gamma" amplitude="1.08" exponent="0.88" offset="0" />
        <feFuncB type="gamma" amplitude="1.08" exponent="0.88" offset="0" />
        <feFuncA type="table" tableValues="0 0.1" />
      </feComponentTransfer>
    </filter>
    <linearGradient id="grain-fade" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.04" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.08" />
    </linearGradient>
  </defs>
  <rect width="${formatNumber(viewWidth)}" height="${formatNumber(viewHeight)}" fill="transparent" />
  <g clip-path="url(#print-area-clip)">
    <rect x="${formatNumber(printX)}" y="${formatNumber(printY)}" width="${formatNumber(printWidth)}" height="${formatNumber(printHeight)}" fill="#ffffff" filter="url(#grain-noise)" opacity="0.75" />
    <rect x="${formatNumber(printX)}" y="${formatNumber(printY)}" width="${formatNumber(printWidth)}" height="${formatNumber(printHeight)}" fill="url(#grain-fade)" opacity="0.22" />
  </g>
`);

    const config = {
        productId: 'basic-tee-white',
        sourceTemplate: '/front.svg',
        format: 'svg',
        viewBox: {
            minX: round(viewBoxParts[0]),
            minY: round(viewBoxParts[1]),
            width: round(viewWidth),
            height: round(viewHeight),
        },
        views: {
            front: {
                base: '/assets/basic-tee-white/front_base.svg',
                mask: '/assets/basic-tee-white/front_mask.svg',
                shadow: '/assets/basic-tee-white/front_shadow.svg',
                highlight: '/assets/basic-tee-white/front_highlight.svg',
                collarOcclusion: '/assets/basic-tee-white/front_collar_occlusion.svg',
                displacement: '/assets/basic-tee-white/front_displacement.svg',
                grain: '/assets/basic-tee-white/front_fabric_grain.svg',
            },
        },
        printArea: {
            front: {
                x: round(printX),
                y: round(printY),
                width: round(printWidth),
                height: round(printHeight),
                safeZone: {
                    x: round(printX + safeInsetX),
                    y: round(printY + safeInsetY),
                    width: round(printWidth - safeInsetX * 2),
                    height: round(printHeight - safeInsetY * 2),
                },
                bleed: {
                    top: bleed,
                    right: bleed,
                    bottom: bleed,
                    left: bleed,
                },
                cornerRadius: printRadius,
                anchor: {
                    x: centerX,
                    y: centerY,
                },
            },
        },
        composeOrder: [
            'base',
            'design',
            'mask',
            'shadow',
            'collarOcclusion',
            'highlight',
            'displacement',
            'grain',
        ],
    };

    await mkdir(outputDir, { recursive: true });
    await Promise.all([
        writeFile(path.join(outputDir, 'front_base.svg'), baseSvg, 'utf8'),
        writeFile(path.join(outputDir, 'front_mask.svg'), maskSvg, 'utf8'),
        writeFile(path.join(outputDir, 'front_shadow.svg'), shadowSvg, 'utf8'),
        writeFile(path.join(outputDir, 'front_highlight.svg'), highlightSvg, 'utf8'),
        writeFile(path.join(outputDir, 'front_collar_occlusion.svg'), collarSvg, 'utf8'),
        writeFile(path.join(outputDir, 'front_displacement.svg'), displacementSvg, 'utf8'),
        writeFile(path.join(outputDir, 'front_fabric_grain.svg'), fabricGrainSvg, 'utf8'),
        writeFile(path.join(outputDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8'),
    ]);

    console.log(`Generated front assets in ${outputDir}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
