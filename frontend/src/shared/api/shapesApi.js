import { apiRequest } from './apiClient';

export function fetchShapes({ search, group, activeOnly = true } = {}) {
    return apiRequest('/shapes', {
        method: 'GET',
        query: {
            search,
            group,
            activeOnly,
        },
    });
}
