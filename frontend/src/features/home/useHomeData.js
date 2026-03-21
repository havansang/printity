import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fallbackTemplates } from './fallbackTemplates';
import { fetchProjects, fetchTemplates } from './homeApi';

function filterTemplates(items, productType) {
    if (!productType || productType === 'all') return items;
    return items.filter((item) => item?.productType === productType);
}

export function useHomeData(productType) {
    const { isAuthenticated, token } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const [templatesError, setTemplatesError] = useState('');
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState('');

    useEffect(() => {
        let isCancelled = false;

        setTemplatesLoading(true);
        setTemplatesError('');

        fetchTemplates({
            productType: productType === 'all' ? undefined : productType,
            activeOnly: true,
        })
            .then((payload) => {
                if (isCancelled) return;
                setTemplates(payload?.data?.items || []);
            })
            .catch((error) => {
                if (isCancelled) return;
                setTemplates(filterTemplates(fallbackTemplates, productType));
                setTemplatesError(error?.message || 'Unable to load templates from the API.');
            })
            .finally(() => {
                if (!isCancelled) setTemplatesLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [productType]);

    useEffect(() => {
        let isCancelled = false;

        if (!isAuthenticated || !token) {
            setProjects([]);
            setProjectsLoading(false);
            setProjectsError('');
            return undefined;
        }

        setProjectsLoading(true);
        setProjectsError('');

        fetchProjects(token)
            .then((payload) => {
                if (isCancelled) return;
                setProjects(payload?.data?.items || []);
            })
            .catch((error) => {
                if (isCancelled) return;
                setProjects([]);
                setProjectsError(error?.message || 'Unable to load your recent projects.');
            })
            .finally(() => {
                if (!isCancelled) setProjectsLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [isAuthenticated, token]);

    const surfaceCount = useMemo(() => {
        const keys = new Set();
        templates.forEach((template) => {
            Object.keys(template?.surfaces || {}).forEach((surfaceKey) => keys.add(surfaceKey));
        });
        return keys.size;
    }, [templates]);

    return {
        templates,
        templatesLoading,
        templatesError,
        projects,
        projectsLoading,
        projectsError,
        surfaceCount,
    };
}
