import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../app/router';
import EditorLayout from '../editor/layout/EditorLayout';
import { useAuth } from '../features/auth/AuthContext';
import { fetchProject, fetchTemplate } from '../features/home/homeApi';
import { resolveRenderableAssetUrl } from '../shared/lib/assetUrls';
import { templates } from '../templates/templates';

const DEFAULT_TEMPLATE_KEY = 'tshirt';
const DEFAULT_TSHIRT_PREVIEW_SCENES = [
    {
        key: 'front',
        label: 'Front',
        sortOrder: 0,
        surfaceKeys: ['front', 'neckLabelInner'],
        isDefault: true,
        isActive: true,
    },
    {
        key: 'back',
        label: 'Back',
        sortOrder: 1,
        surfaceKeys: ['back'],
        isDefault: false,
        isActive: true,
    },
    {
        key: 'frontCollarCloseup',
        label: 'Front Collar Closeup',
        sortOrder: 2,
        surfaceKeys: ['neckLabelInner'],
        isDefault: false,
        isActive: true,
    },
    {
        key: 'folded',
        label: 'Folded',
        sortOrder: 3,
        surfaceKeys: ['front', 'neckLabelInner'],
        isDefault: false,
        isActive: true,
    },
];

function normalizePreviewScenes(productType, supportedSurfaceKeys, previewScenes) {
    const normalizedSupportedSurfaceKeys = Array.isArray(supportedSurfaceKeys)
        ? supportedSurfaceKeys.map((key) => String(key || '').trim()).filter(Boolean)
        : [];
    const normalizedPreviewScenes = Array.isArray(previewScenes)
        ? previewScenes
            .filter((scene) => scene?.isActive !== false && scene?.key)
            .map((scene) => ({
                key: String(scene.key || '').trim(),
                label: scene.label || scene.key,
                sortOrder: scene.sortOrder ?? 0,
                surfaceKeys: Array.isArray(scene.surfaceKeys) ? scene.surfaceKeys : [],
                isDefault: scene.isDefault === true,
                isActive: scene.isActive !== false,
            }))
        : [];

    if (
        String(productType || '').trim().toLowerCase() !== 'tshirt'
        || !normalizedSupportedSurfaceKeys.includes('front')
        || !normalizedSupportedSurfaceKeys.includes('back')
        || !normalizedSupportedSurfaceKeys.includes('neckLabelInner')
    ) {
        return normalizedPreviewScenes;
    }

    const looksLikeLegacySurfaceFallback = normalizedPreviewScenes.length === 0
        || normalizedPreviewScenes.every((scene) => normalizedSupportedSurfaceKeys.includes(scene.key));

    if (looksLikeLegacySurfaceFallback) {
        return DEFAULT_TSHIRT_PREVIEW_SCENES;
    }

    const defaultSceneMap = new Map(DEFAULT_TSHIRT_PREVIEW_SCENES.map((scene) => [scene.key, scene]));
    const mergedDefaultScenes = DEFAULT_TSHIRT_PREVIEW_SCENES.map((defaultScene) => {
        const matchedScene = normalizedPreviewScenes.find((scene) => scene.key === defaultScene.key);
        if (!matchedScene) {
            return defaultScene;
        }

        return {
            ...defaultScene,
            ...matchedScene,
            surfaceKeys: matchedScene.surfaceKeys?.length > 0 ? matchedScene.surfaceKeys : defaultScene.surfaceKeys,
        };
    });
    const extraScenes = normalizedPreviewScenes.filter((scene) => !defaultSceneMap.has(scene.key));

    return [...mergedDefaultScenes, ...extraScenes];
}

const DEFAULT_TEMPLATE_DEF = {
    ...templates[DEFAULT_TEMPLATE_KEY],
    id: DEFAULT_TEMPLATE_KEY,
    templateKey: DEFAULT_TEMPLATE_KEY,
    name: 'Basic T-shirt',
    productType: 'tshirt',
    slug: 'basic-tshirt',
    availableColors: [],
    previewScenes: DEFAULT_TSHIRT_PREVIEW_SCENES,
};

function buildEditorTemplateDefinition(template) {
    if (!template || typeof template !== 'object') {
        return null;
    }

    const supportedSurfaceKeys = Array.isArray(template?.supportedSurfaces) && template.supportedSurfaces.length > 0
        ? template.supportedSurfaces
        : Object.keys(template?.surfaces || {});

    const nextDefinition = {
        id: template.id,
        templateKey: template.slug || template.id,
        name: template.name || 'Product editor',
        productType: template.productType || 'tshirt',
        slug: template.slug || '',
        availableColors: Array.isArray(template?.availableColors) ? template.availableColors : [],
        defaultRenderOptions: template.defaultRenderOptions || null,
        supportedSurfaces: [],
        previewScenes: [],
    };

    supportedSurfaceKeys.forEach((surfaceKey) => {
        const surface = template?.surfaces?.[surfaceKey];
        const editor = surface?.editor;
        const svgUrl = resolveRenderableAssetUrl(editor?.svgUrl);

        if (!surface || !svgUrl) {
            return;
        }

        nextDefinition[surfaceKey] = {
            svg: svgUrl,
            label: surface.label || surfaceKey,
            placeholderId: editor?.placeholderId || `placeholder_${surfaceKey}`,
            printArea: editor?.printArea || surface?.printArea || null,
            sceneWidth: editor?.sceneWidth || surface?.editor?.sceneWidth || null,
            sceneHeight: editor?.sceneHeight || surface?.editor?.sceneHeight || null,
            position: surface?.position || (surfaceKey === 'neckLabelInner' ? 'neck' : surfaceKey),
            domId: Array.isArray(surface?.domId) ? surface.domId : [],
            sequence: surface?.sequence ?? 0,
            printable: surface?.printable !== false,
            allowedDecorationMethods: Array.isArray(surface?.allowedDecorationMethods)
                ? surface.allowedDecorationMethods
                : [],
        };
        nextDefinition.supportedSurfaces.push(surfaceKey);
    });

    nextDefinition.previewScenes = normalizePreviewScenes(
        nextDefinition.productType,
        nextDefinition.supportedSurfaces,
        template?.previewScenes
    );

    return nextDefinition.supportedSurfaces.length > 0 ? nextDefinition : null;
}

function RouteLoadingState({ message }) {
    return (
        <div className="route-fallback">
            <div className="route-fallback-dot" />
            <span>{message}</span>
        </div>
    );
}

function TemplateErrorState({ message }) {
    return (
        <div className="editor-template-state">
            <div className="editor-template-card">
                <p className="section-kicker">Editor</p>
                <h1>Template could not be opened.</h1>
                <p>{message}</p>
                <div className="editor-template-actions">
                    <button type="button" className="primary-action" onClick={() => navigate('/dashboard')}>
                        Back to dashboard
                    </button>
                    <button type="button" className="header-outline-action" onClick={() => navigate('/editor', { replace: true })}>
                        Open default T-shirt editor
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function EditorPage({ search }) {
    const { isAuthenticated, isInitializing, token } = useAuth();
    const { projectId, templateId } = useMemo(() => {
        const params = new URLSearchParams(search || '');
        return {
            projectId: params.get('projectId') || '',
            templateId: params.get('templateId') || '',
        };
    }, [search]);

    const [templateDef, setTemplateDef] = useState(() => (
        projectId || templateId ? null : DEFAULT_TEMPLATE_DEF
    ));
    const [project, setProject] = useState(null);
    const [isLoading, setIsLoading] = useState(Boolean(projectId || templateId));
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (projectId && !isInitializing && !isAuthenticated) {
            navigate('/auth?mode=login', { replace: true });
        }
    }, [isAuthenticated, isInitializing, projectId]);

    useEffect(() => {
        let isCancelled = false;

        if (projectId && !token) {
            if (isInitializing) {
                return undefined;
            }
            setTemplateDef(null);
            setProject(null);
            setErrorMessage('Sign in to reopen this saved project.');
            setIsLoading(false);
            return undefined;
        }

        if (!projectId && !templateId) {
            setTemplateDef(DEFAULT_TEMPLATE_DEF);
            setProject(null);
            setErrorMessage('');
            setIsLoading(false);
            return undefined;
        }

        setIsLoading(true);
        setErrorMessage('');

        const request = projectId
            ? fetchProject(token, projectId)
            : fetchTemplate(templateId);

        request
            .then((payload) => {
                if (isCancelled) return;

                if (projectId) {
                    const nextProject = payload?.data?.project || null;
                    const nextTemplateDef = buildEditorTemplateDefinition(nextProject?.template);
                    if (!nextTemplateDef) {
                        throw new Error('The saved project has no supported editor surfaces.');
                    }

                    setProject(nextProject);
                    setTemplateDef(nextTemplateDef);
                    return;
                }

                const nextTemplateDef = buildEditorTemplateDefinition(payload?.data?.template);
                if (!nextTemplateDef) {
                    throw new Error('The selected template has no supported editor surfaces.');
                }

                setProject(null);
                setTemplateDef(nextTemplateDef);
            })
            .catch((error) => {
                if (isCancelled) return;
                setTemplateDef(null);
                setProject(null);
                setErrorMessage(error?.message || 'Unable to load this template.');
            })
            .finally(() => {
                if (!isCancelled) setIsLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [isInitializing, projectId, templateId, token]);

    if (isLoading) {
        return <RouteLoadingState message={projectId ? 'Loading saved project...' : 'Loading template editor...'} />;
    }

    if (errorMessage || !templateDef) {
        return <TemplateErrorState message={errorMessage || 'Template data is unavailable.'} />;
    }

    return (
        <EditorLayout
            key={project?.id || templateDef.id || templateDef.templateKey || templateDef.slug || DEFAULT_TEMPLATE_KEY}
            templateDef={templateDef}
            initialProject={project}
        />
    );
}
