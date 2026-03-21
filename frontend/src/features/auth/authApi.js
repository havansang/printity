import { apiRequest } from '../../shared/api/apiClient';

export function register(payload) {
    return apiRequest('/auth/register', {
        method: 'POST',
        body: payload,
    });
}

export function login(payload) {
    return apiRequest('/auth/login', {
        method: 'POST',
        body: payload,
    });
}

export function loginWithGoogle(payload) {
    return apiRequest('/auth/google', {
        method: 'POST',
        body: payload,
    });
}

export function getCurrentUser(token) {
    return apiRequest('/auth/me', {
        method: 'GET',
        token,
    });
}

export function logout(token) {
    return apiRequest('/auth/logout', {
        method: 'POST',
        token,
    });
}
