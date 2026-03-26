import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../app/router';
import EditorLayout from '../editor/layout/EditorLayout';
import { fetchTemplate } from '../features/home/homeApi';
import { resolveRenderableAssetUrl } from '../shared/lib/assetUrls';
import { templates } from '../templates/templates';

const DEFAULT_TEMPLATE_KEY = 'tshirt';
const DEFAULT_TEMPLATE_DEF = {
    ...templates[DEFAULT_TEMPLATE_KEY],
    id: DEFAULT_TEMPLATE_KEY,
    templateKey: DEFAULT_TEMPLATE_KEY,
    name: 'Basic T-shirt',
    productType: 'tshirt',
    slug: 'basic-tshirt',
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
        defaultRenderOptions: template.defaultRenderOptions || null,
        supportedSurfaces: [],
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
        };
        nextDefinition.supportedSurfaces.push(surfaceKey);
    });

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
    const templateId = useMemo(() => {
        const params = new URLSearchParams(search || '');
        return params.get('templateId') || '';
    }, [search]);

    const [templateDef, setTemplateDef] = useState(() => (
        templateId ? null : DEFAULT_TEMPLATE_DEF
    ));
    const [isLoading, setIsLoading] = useState(Boolean(templateId));
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        let isCancelled = false;

        if (!templateId) {
            setTemplateDef(DEFAULT_TEMPLATE_DEF);
            setErrorMessage('');
            setIsLoading(false);
            return undefined;
        }

        setIsLoading(true);
        setErrorMessage('');

        fetchTemplate(templateId)
            .then((payload) => {
                if (isCancelled) return;
                const nextTemplateDef = buildEditorTemplateDefinition(payload?.data?.template);
                if (!nextTemplateDef) {
                    throw new Error('The selected template has no supported editor surfaces.');
                }
                setTemplateDef(nextTemplateDef);
            })
            .catch((error) => {
                if (isCancelled) return;
                setTemplateDef(null);
                setErrorMessage(error?.message || 'Unable to load this template.');
            })
            .finally(() => {
                if (!isCancelled) setIsLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [templateId]);

    if (isLoading) {
        return <RouteLoadingState message="Loading template editor..." />;
    }

    if (errorMessage || !templateDef) {
        return <TemplateErrorState message={errorMessage || 'Template data is unavailable.'} />;
    }

    return (
        <EditorLayout
            key={templateDef.id || templateDef.templateKey || templateDef.slug || DEFAULT_TEMPLATE_KEY}
            templateDef={templateDef}
        />
    );
}
