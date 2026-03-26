import { apiRequest } from './apiClient';

export function fetchProductColors() {
    return apiRequest('/colors', {
        method: 'GET',
    });
}
