import { APP_CONFIG } from '../../shared/config/appConfig';

export const DEFAULT_EDITOR_FONT_FAMILY = 'Arial';

const FALLBACK_EDITOR_FONTS = [
    { family: 'Arial', source: 'system', category: 'sans-serif', variants: [] },
    { family: 'Georgia', source: 'system', category: 'serif', variants: [] },
    { family: 'Times New Roman', source: 'system', category: 'serif', variants: [] },
    { family: 'Courier New', source: 'system', category: 'monospace', variants: [] },
    { family: 'Verdana', source: 'system', category: 'sans-serif', variants: [] },
    { family: 'Trebuchet MS', source: 'system', category: 'sans-serif', variants: [] },
];

function quoteFontFamily(family) {
    const primaryFamily = String(family || '').trim();
    if (!primaryFamily) return DEFAULT_EDITOR_FONT_FAMILY;
    return /[\s"']/.test(primaryFamily) ? `"${primaryFamily.replace(/"/g, '\\"')}"` : primaryFamily;
}

function buildFontDescriptor(family, fontWeight = 400, fontStyle = 'normal') {
    const normalizedFamily = normalizeFontFamily(family);
    return `${normalizeFontStyle(fontStyle)} ${normalizeFontWeight(fontWeight)} 16px ${quoteFontFamily(normalizedFamily)}`;
}

export function normalizeFontFamily(value) {
    const primaryFamily = String(value || '')
        .split(',')[0]
        .trim()
        .replace(/^["']+|["']+$/g, '');

    return primaryFamily || DEFAULT_EDITOR_FONT_FAMILY;
}

function normalizeFontWeight(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    const rawValue = String(value || '').trim().toLowerCase();
    if (!rawValue) return 400;
    if (rawValue === 'normal' || rawValue === 'regular') return 400;
    if (rawValue === 'bold') return 700;

    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : 400;
}

function normalizeFontStyle(value) {
    const rawValue = String(value || 'normal').trim().toLowerCase();
    return rawValue.includes('italic') || rawValue.includes('oblique') ? 'italic' : 'normal';
}

function getGenericFallback(category) {
    const normalizedCategory = String(category || '').trim().toLowerCase();
    if (normalizedCategory.includes('mono')) return 'monospace';
    if (normalizedCategory.includes('serif')) return 'serif';
    return 'sans-serif';
}

export function toCssFontFamily(family, category) {
    return `${quoteFontFamily(normalizeFontFamily(family))}, ${getGenericFallback(category)}`;
}

function mapFontEntry(entry) {
    const family = normalizeFontFamily(entry?.family);
    const category = entry?.category || null;

    return {
        family,
        category,
        source: entry?.source || 'catalog',
        variantCount: entry?.variantCount || 0,
        variants: Array.isArray(entry?.variants)
            ? entry.variants.map((variant) => ({
                fontVariant: variant?.fontVariant || null,
                fontWeight: normalizeFontWeight(variant?.fontWeight),
                fontStyle: normalizeFontStyle(variant?.fontStyle),
                label: variant?.label || null,
                relativePath: variant?.relativePath || null,
                remoteUrl: variant?.remoteUrl || null,
            }))
            : [],
        cssFamily: toCssFontFamily(family, category),
    };
}

export function mergeEditorFonts(items = [], fallbackFamilies = []) {
    const merged = new Map();

    const addFont = (entry) => {
        const mappedEntry = typeof entry === 'string' ? mapFontEntry({ family: entry, source: 'system' }) : mapFontEntry(entry);
        if (!mappedEntry.family) return;

        if (!merged.has(mappedEntry.family)) {
            merged.set(mappedEntry.family, mappedEntry);
            return;
        }

        const current = merged.get(mappedEntry.family);
        if ((!current.variants || current.variants.length === 0) && mappedEntry.variants.length > 0) {
            merged.set(mappedEntry.family, mappedEntry);
        }
    };

    items.forEach(addFont);
    fallbackFamilies.forEach(addFont);
    FALLBACK_EDITOR_FONTS.forEach(addFont);

    return Array.from(merged.values()).sort((left, right) => left.family.localeCompare(right.family));
}

export function findEditorFontByFamily(fonts, family) {
    const normalizedFamily = normalizeFontFamily(family);
    return (Array.isArray(fonts) ? fonts : []).find((entry) => normalizeFontFamily(entry?.family) === normalizedFamily) || null;
}

function pickPreferredVariant(variants = [], requestedWeight = 400, requestedStyle = 'normal') {
    const normalizedWeight = normalizeFontWeight(requestedWeight);
    const normalizedStyle = normalizeFontStyle(requestedStyle);
    const items = Array.isArray(variants) ? variants : [];

    let bestMatch = null;
    let bestScore = -Infinity;

    items.forEach((variant) => {
        const candidateWeight = normalizeFontWeight(variant?.fontWeight);
        const candidateStyle = normalizeFontStyle(variant?.fontStyle);
        let score = 0;

        score -= Math.abs(candidateWeight - normalizedWeight);
        if (candidateStyle === normalizedStyle) score += 2000;
        if (candidateWeight === normalizedWeight) score += 1500;
        if (candidateStyle === 'normal' && normalizedStyle === 'normal') score += 200;
        if (candidateWeight === 400 && normalizedWeight === 400) score += 100;

        if (score > bestScore) {
            bestMatch = variant;
            bestScore = score;
        }
    });

    return bestMatch || items[0] || null;
}

export function pickEditorFontVariant(fontEntry, { fontWeight = 400, fontStyle = 'normal' } = {}) {
    return pickPreferredVariant(fontEntry?.variants, fontWeight, fontStyle);
}

function buildFontAssetUrl(relativePath) {
    const normalizedPath = String(relativePath || '').replace(/^\/+/, '');
    if (!normalizedPath) return null;

    const apiBaseUrl = new URL(APP_CONFIG.apiBaseUrl, window.location.origin);
    return new URL(`/fonts/${normalizedPath}`, apiBaseUrl).toString();
}

function canUseBrowserFontApi() {
    return typeof window !== 'undefined' && typeof document !== 'undefined' && 'fonts' in document && typeof FontFace !== 'undefined';
}

function createFontLoadKey(family, fontWeight = 400, fontStyle = 'normal') {
    return `${normalizeFontFamily(family)}::${normalizeFontWeight(fontWeight)}::${normalizeFontStyle(fontStyle)}`;
}

export async function loadEditorFontFace(fontEntry, { fontWeight = 400, fontStyle = 'normal' } = {}) {
    const family = normalizeFontFamily(fontEntry?.family);
    if (!family || !canUseBrowserFontApi()) {
        return family || DEFAULT_EDITOR_FONT_FAMILY;
    }

    const variant = pickPreferredVariant(fontEntry?.variants, fontWeight, fontStyle);
    const fontUrl = buildFontAssetUrl(variant?.relativePath) || variant?.remoteUrl || null;
    if (!fontUrl) {
        return family;
    }

    const response = await fetch(fontUrl, { mode: 'cors' });
    if (!response.ok) {
        throw new Error(`Unable to load font asset for ${family}`);
    }

    const fontBuffer = await response.arrayBuffer();
    const fontFace = new FontFace(
        family,
        fontBuffer,
        {
            weight: String(normalizeFontWeight(variant?.fontWeight ?? fontWeight)),
            style: normalizeFontStyle(variant?.fontStyle ?? fontStyle),
        }
    );

    const loadedFace = await fontFace.load();
    document.fonts.add(loadedFace);
    await document.fonts.load(
        buildFontDescriptor(
            family,
            variant?.fontWeight ?? fontWeight,
            variant?.fontStyle ?? fontStyle
        )
    );
    await document.fonts.ready;

    return family;
}

export {
    canUseBrowserFontApi,
    createFontLoadKey,
    normalizeFontStyle,
    normalizeFontWeight,
};
