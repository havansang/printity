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

export function fetchProject(token, projectId) {
    return apiRequest(`/projects/${projectId}`, {
        method: 'GET',
        token,
    });
}

export function createProject(token, body) {
    return apiRequest('/projects', {
        method: 'POST',
        token,
        body,
    });
}

export function updateProject(token, projectId, body) {
    return apiRequest(`/projects/${projectId}`, {
        method: 'PUT',
        token,
        body,
    });
}

export function deleteProject(token, projectId) {
    return apiRequest(`/projects/${projectId}`, {
        method: 'DELETE',
        token,
    });
}
