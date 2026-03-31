function resolveApiBaseUrl() {
    const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();

    if (typeof window === 'undefined') {
        return configuredUrl || 'http://localhost:5000/api/v1';
    }

    const fallbackUrl = `${window.location.protocol}//${window.location.hostname}:5000/api/v1`;

    if (!configuredUrl) {
        return fallbackUrl;
    }

    try {
        const parsedUrl = new URL(configuredUrl);

        if (parsedUrl.hostname === 'localhost' && window.location.hostname !== 'localhost') {
            parsedUrl.hostname = window.location.hostname;
            return parsedUrl.toString().replace(/\/$/, '');
        }

        return parsedUrl.toString().replace(/\/$/, '');
    } catch {
        return configuredUrl;
    }
}

export const APP_CONFIG = {
    apiBaseUrl: resolveApiBaseUrl(),
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '',
    projectName: 'Printity',
};
