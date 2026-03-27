import { apiRequest } from './apiClient';

export function fetchAssets(token) {
    return apiRequest('/assets', {
        method: 'GET',
        token,
    });
}

export function uploadAsset(token, file) {
    const formData = new FormData();
    formData.append('file', file);

    return apiRequest('/assets/upload', {
        method: 'POST',
        token,
        body: formData,
    });
}

export function deleteAsset(token, assetId) {
    return apiRequest(`/assets/${assetId}`, {
        method: 'DELETE',
        token,
    });
}
