import { apiRequest } from './apiClient';

export function fetchProductColors({ productType } = {}) {
    return apiRequest('/colors', {
        method: 'GET',
        query: {
            productType,
        },
    });
}
