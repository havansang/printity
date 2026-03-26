import { apiRequest } from './apiClient';

export function fetchBackendFonts({ search, includeVariants = true } = {}) {
    return apiRequest('/fonts', {
        method: 'GET',
        query: {
            search,
            includeVariants,
        },
    });
}
