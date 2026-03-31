import { apiBinaryRequest, apiRequest } from './apiClient';

export function previewMockups(body, { token } = {}) {
    return apiRequest('/mockups/preview', {
        method: 'POST',
        token,
        body,
    });
}

export function previewMockupsBinary(body, { token } = {}) {
    return apiBinaryRequest('/mockups/preview', {
        method: 'POST',
        token,
        body,
    });
}
