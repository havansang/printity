import { APP_CONFIG } from '../config/appConfig';
import { dispatchAuthSessionExpired } from '../../features/auth/authSessionEvents';

function buildUrl(path, query) {
    const base = APP_CONFIG.apiBaseUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${normalizedPath}`);

    Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        url.searchParams.set(key, String(value));
    });

    return url.toString();
}

export async function apiRequest(path, {
    method = 'GET',
    body,
    token,
    query,
    headers = {},
    skipAuthRedirect = false,
} = {}) {
    const requestHeaders = {
        Accept: 'application/json',
        ...headers,
    };

    if (token) {
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    let requestBody;
    if (body instanceof FormData) {
        requestBody = body;
    } else if (body !== undefined) {
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
    }

    const response = await fetch(buildUrl(path, query), {
        method,
        headers: requestHeaders,
        body: requestBody,
    });

    const rawText = await response.text();
    let payload = null;

    if (rawText) {
        try {
            payload = JSON.parse(rawText);
        } catch (error) {
            payload = null;
        }
    }

    if (!response.ok || payload?.success === false) {
        if (response.status === 401 && token && !skipAuthRedirect) {
            dispatchAuthSessionExpired({
                path,
                method,
                status: response.status,
                message: payload?.message || 'Session expired',
            });
        }

        const apiError = new Error(
            payload?.message || `Request failed with status ${response.status}`
        );
        apiError.status = response.status;
        apiError.errors = payload?.errors || [];
        apiError.payload = payload;
        throw apiError;
    }

    return payload || {
        success: true,
        message: 'Request completed successfully',
        data: {},
    };
}

export async function apiBinaryRequest(path, {
    method = 'GET',
    body,
    token,
    query,
    headers = {},
    skipAuthRedirect = false,
} = {}) {
    const requestHeaders = {
        Accept: 'application/octet-stream, image/png, image/jpeg, image/webp, application/json',
        ...headers,
    };

    if (token) {
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    let requestBody;
    if (body instanceof FormData) {
        requestBody = body;
    } else if (body !== undefined) {
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
    }

    const response = await fetch(buildUrl(path, query), {
        method,
        headers: requestHeaders,
        body: requestBody,
    });

    if (!response.ok) {
        const rawText = await response.text();
        let payload = null;

        if (rawText) {
            try {
                payload = JSON.parse(rawText);
            } catch {
                payload = null;
            }
        }

        if (response.status === 401 && token && !skipAuthRedirect) {
            dispatchAuthSessionExpired({
                path,
                method,
                status: response.status,
                message: payload?.message || 'Session expired',
            });
        }

        const apiError = new Error(
            payload?.message || `Request failed with status ${response.status}`
        );
        apiError.status = response.status;
        apiError.errors = payload?.errors || [];
        apiError.payload = payload;
        throw apiError;
    }

    const blob = await response.blob();

    return {
        blob,
        mimeType: response.headers.get('Content-Type') || blob.type || 'application/octet-stream',
    };
}
