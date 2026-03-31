import { APP_CONFIG } from '../config/appConfig';

const BACKEND_ASSET_PREFIXES = ['/mockups/', '/fonts/', '/uploads/'];

export function resolveRenderableAssetUrl(assetPath) {
    const value = String(assetPath || '').trim();
    if (!value) return '';

    if (
        /^https?:\/\//i.test(value)
        || value.startsWith('//')
        || value.startsWith('data:')
        || value.startsWith('blob:')
    ) {
        return value;
    }

    if (!BACKEND_ASSET_PREFIXES.some((prefix) => value.startsWith(prefix))) {
        return value;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const apiBaseUrl = new URL(APP_CONFIG.apiBaseUrl, origin);
    return new URL(value, apiBaseUrl).toString();
}
