export const APP_CONFIG = {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '',
    projectName: 'Printity',
};
