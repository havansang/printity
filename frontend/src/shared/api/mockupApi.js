import { apiRequest } from './apiClient';

export function previewMockups(body, { token } = {}) {
    return apiRequest('/mockups/preview', {
        method: 'POST',
        token,
        body,
    });
}
