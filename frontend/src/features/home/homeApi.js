import { apiRequest } from '../../shared/api/apiClient';

export function fetchTemplates({ productType, activeOnly = true } = {}) {
    return apiRequest('/templates', {
        method: 'GET',
        query: {
            productType,
            activeOnly,
        },
    });
}

export function fetchTemplate(templateId) {
    return apiRequest(`/templates/${templateId}`, {
        method: 'GET',
    });
}

export function fetchProjects(token, {
    page = 1,
    limit = 6,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
} = {}) {
    return apiRequest('/projects', {
        method: 'GET',
        token,
        query: {
            page,
            limit,
            sortBy,
            sortOrder,
        },
    });
}
