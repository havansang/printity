import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from './EditorContext';
import {
    buildSurfacePreview,
    createSvgObjectUrl,
    rasterizePreviewSvg,
} from './previewUtils';
import {
    buildMockupFilename,
    buildMockupPreviewPayload,
    canUseMockupPreviewApi,
    createMockupPreviewRequest,
    resolveMockupPreviewSize,
} from './mockupPreviewPayload';
import { previewMockups, previewMockupsBinary } from '../../shared/api/mockupApi';

const THUMBNAIL_PREVIEW_SIZE = 400;
const MAX_SERVER_PREVIEW_RESPONSE_CACHE_ENTRIES = 24;
const MAX_SERVER_PREVIEW_BINARY_CACHE_ENTRIES = 24;
const SERVER_PREVIEW_RESPONSE_CACHE = new Map();
const SERVER_PREVIEW_REQUEST_CACHE = new Map();
const SERVER_PREVIEW_BINARY_RESPONSE_CACHE = new Map();
const SERVER_PREVIEW_BINARY_REQUEST_CACHE = new Map();

function setLruCacheEntry(cache, key, value, maxEntries, onEvict) {
    if (cache.has(key)) {
        cache.delete(key);
    }

    cache.set(key, value);

    while (cache.size > maxEntries) {
        const oldestKey = cache.keys().next().value;
        const oldestValue = cache.get(oldestKey);
        cache.delete(oldestKey);
        onEvict?.(oldestValue, oldestKey);
    }
}

function buildPreviewStateKey({
    orderedSurfaceDefs,
    orderedSceneDefs,
    snapshots,
    surfacePrintAreas,
    shirtColor,
    templateDef,
    uploadedImages,
}) {
    return JSON.stringify({
        templateKey: String(
            templateDef?.id
            || templateDef?._id
            || templateDef?.backendId
            || templateDef?.slug
            || templateDef?.name
            || ''
        ).trim(),
        shirtColor: String(shirtColor || '').trim(),
        surfaceKeys: orderedSurfaceDefs.map((surfaceDef) => surfaceDef.key),
        sceneKeys: orderedSceneDefs.map((sceneDef) => sceneDef.key),
        snapshots: orderedSurfaceDefs.map((surfaceDef) => snapshots?.[surfaceDef.key] || null),
        printAreas: orderedSurfaceDefs.map((surfaceDef) => ({
            key: surfaceDef.key,
            printArea: surfacePrintAreas?.[surfaceDef.key] || null,
        })),
        uploadedImages: (Array.isArray(uploadedImages) ? uploadedImages : []).map((item) => ({
            id: item?.id || '',
            url: item?.url || '',
            mimeType: item?.mimeType || '',
        })),
    });
}

function triggerDownload(href, filename) {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
}

function buildPreviewRequestKey(payload) {
    return JSON.stringify(payload);
}

async function requestServerPreview(payload) {
    const requestKey = buildPreviewRequestKey(payload);

    if (SERVER_PREVIEW_RESPONSE_CACHE.has(requestKey)) {
        return SERVER_PREVIEW_RESPONSE_CACHE.get(requestKey);
    }

    if (SERVER_PREVIEW_REQUEST_CACHE.has(requestKey)) {
        return SERVER_PREVIEW_REQUEST_CACHE.get(requestKey);
    }

    const request = previewMockups(payload)
        .then((response) => {
            setLruCacheEntry(
                SERVER_PREVIEW_RESPONSE_CACHE,
                requestKey,
                response,
                MAX_SERVER_PREVIEW_RESPONSE_CACHE_ENTRIES
            );
            return response;
        })
        .finally(() => {
            SERVER_PREVIEW_REQUEST_CACHE.delete(requestKey);
        });

    SERVER_PREVIEW_REQUEST_CACHE.set(requestKey, request);
    return request;
}

async function requestServerBinaryPreview(payload) {
    const requestKey = buildPreviewRequestKey(payload);

    if (SERVER_PREVIEW_BINARY_RESPONSE_CACHE.has(requestKey)) {
        return SERVER_PREVIEW_BINARY_RESPONSE_CACHE.get(requestKey);
    }

    if (SERVER_PREVIEW_BINARY_REQUEST_CACHE.has(requestKey)) {
        return SERVER_PREVIEW_BINARY_REQUEST_CACHE.get(requestKey);
    }

    const request = previewMockupsBinary(payload)
        .then((response) => {
            const objectUrl = URL.createObjectURL(response.blob);
            const cachedResponse = {
                objectUrl,
                mimeType: response.mimeType,
            };

            setLruCacheEntry(
                SERVER_PREVIEW_BINARY_RESPONSE_CACHE,
                requestKey,
                cachedResponse,
                MAX_SERVER_PREVIEW_BINARY_CACHE_ENTRIES,
                (evictedValue) => {
                    if (evictedValue?.objectUrl) {
                        URL.revokeObjectURL(evictedValue.objectUrl);
                    }
                }
            );

            return cachedResponse;
        })
        .finally(() => {
            SERVER_PREVIEW_BINARY_REQUEST_CACHE.delete(requestKey);
        });

    SERVER_PREVIEW_BINARY_REQUEST_CACHE.set(requestKey, request);
    return request;
}

function getOrderedSurfaceDefs(surfaceDefs) {
    const preferredOrder = ['front', 'back', 'neckLabelInner'];
    const orderMap = new Map(preferredOrder.map((surfaceKey, index) => [surfaceKey, index]));

    return [...surfaceDefs].sort((left, right) => {
        const leftOrder = orderMap.get(left?.key);
        const rightOrder = orderMap.get(right?.key);

        if (leftOrder !== undefined || rightOrder !== undefined) {
            return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
        }

        return 0;
    });
}

function getOrderedSceneDefs(templateDef, orderedSurfaceDefs) {
    const templateScenes = Array.isArray(templateDef?.previewScenes)
        ? templateDef.previewScenes.filter((scene) => scene?.isActive !== false && scene?.key)
        : [];

    if (templateScenes.length > 0) {
        return [...templateScenes].sort((left, right) => (
            (left?.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right?.sortOrder ?? Number.MAX_SAFE_INTEGER)
        ));
    }

    return orderedSurfaceDefs.map((surfaceDef, index) => ({
        key: surfaceDef.key,
        label: surfaceDef.label,
        sortOrder: index,
        surfaceKeys: [surfaceDef.key],
        isDefault: index === 0,
        isActive: true,
    }));
}

async function buildClientPreviewItems({
    surfaceDefs,
    snapshots,
    surfacePrintAreas,
    shirtColor,
    templateDef,
}) {
    const objectUrls = [];
    const items = await Promise.all(surfaceDefs.map(async (surfaceDef) => {
        const surface = surfaceDef.key;
        const source = surfaceDef.svg;

        if (!source) {
            return null;
        }

        const response = await fetch(source);
        if (!response.ok) {
            throw new Error(`Failed to load ${surface} template`);
        }

        const svgText = await response.text();
        const preview = await buildSurfacePreview({
            surface,
            placeholderId: surfaceDef.placeholderId,
            svgText,
            snapshot: snapshots?.[surface],
            printArea: surfacePrintAreas?.[surface],
            shirtColor,
        });

        const previewUrl = createSvgObjectUrl(preview.svgMarkup);
        objectUrls.push(previewUrl);

        return {
            source: 'client',
            scene: surface,
            label: surfaceDef.label,
            filename: buildMockupFilename({
                templateDef,
                sceneKey: surface,
                format: 'png',
                mimeType: 'image/png',
            }),
            previewUrl,
            svgMarkup: preview.svgMarkup,
            width: preview.width,
            height: preview.height,
            mimeType: 'image/png',
        };
    }));

    return {
        items: items.filter(Boolean),
        objectUrls,
    };
}

function mapApiPreviewItems({ response, sceneDefs, templateDef }) {
    const previews = Array.isArray(response?.data?.previews) ? response.data.previews : [];
    const labelsByScene = new Map(sceneDefs.map((sceneDef) => [sceneDef.key, sceneDef.label]));
    const sceneOrder = new Map(sceneDefs.map((sceneDef, index) => [sceneDef.key, index]));

    return previews
        .map((preview) => {
            const sceneKey = preview.sceneKey || preview.surfaceKey;

            return {
                source: 'server',
                scene: sceneKey,
                label: preview.label || labelsByScene.get(sceneKey) || sceneKey,
                filename: buildMockupFilename({
                    templateDef,
                    sceneKey,
                    format: response?.data?.format,
                    mimeType: preview.mimeType,
                }),
                previewUrl: preview.dataUrl,
                thumbnailUrl: preview.dataUrl,
                fullPreviewUrl: null,
                hasFullResolution: false,
                width: preview.width,
                height: preview.height,
                mimeType: preview.mimeType,
            };
        })
        .sort((left, right) => (
            (sceneOrder.get(left.scene) ?? Number.MAX_SAFE_INTEGER)
            - (sceneOrder.get(right.scene) ?? Number.MAX_SAFE_INTEGER)
        ));
}

function getPreviewDisplayUrl(item) {
    return item?.fullPreviewUrl || item?.thumbnailUrl || item?.previewUrl || '';
}

export default function PreviewWorkspace() {
    const {
        canvasRef,
        activeSurface,
        shirtColor,
        shirtColors,
        surfaceDefs,
        surfacePrintAreas,
        captureSurfaceSnapshots,
        uploadedImages,
        hasDesignContent,
        isSavingProduct,
        saveProduct,
        templateDef,
        isPreviewMode,
    } = useEditor();

    const orderedSurfaceDefs = useMemo(() => getOrderedSurfaceDefs(surfaceDefs), [surfaceDefs]);
    const orderedSceneDefs = useMemo(
        () => getOrderedSceneDefs(templateDef, orderedSurfaceDefs),
        [orderedSurfaceDefs, templateDef]
    );
    const initialSceneKey = orderedSceneDefs.find((scene) => scene.isDefault)?.key || orderedSceneDefs[0]?.key || '';
    const [previewItemsByScene, setPreviewItemsByScene] = useState({});
    const previewItemsBySceneRef = useRef({});
    const previewObjectUrlsRef = useRef([]);
    const previewBuildSignatureRef = useRef('');
    const serverBasePayloadRef = useRef(null);
    const [selectedScene, setSelectedScene] = useState(initialSceneKey);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingFullScene, setLoadingFullScene] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [downloadScene, setDownloadScene] = useState('');
    const [saveMessage, setSaveMessage] = useState('');
    const fullPreviewSize = useMemo(
        () => resolveMockupPreviewSize(templateDef?.defaultRenderOptions?.size || 2048),
        [templateDef]
    );

    useEffect(() => {
        previewItemsBySceneRef.current = previewItemsByScene;
    }, [previewItemsByScene]);

    useEffect(() => (
        () => {
            previewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            previewObjectUrlsRef.current = [];
        }
    ), []);

    useEffect(() => {
        if (!isPreviewMode) {
            serverBasePayloadRef.current = null;
            return undefined;
        }

        let cancelled = false;

        async function buildPreviews() {
            setIsLoading(true);
            setLoadingFullScene('');
            setErrorMessage('');
            setSaveMessage('');

            try {
                const snapshots = captureSurfaceSnapshots();
                const nextInitialSceneKey = orderedSceneDefs.find((scene) => scene.isDefault)?.key || orderedSceneDefs[0]?.key || '';
                const nextBuildSignature = buildPreviewStateKey({
                    orderedSurfaceDefs,
                    orderedSceneDefs,
                    snapshots,
                    surfacePrintAreas,
                    shirtColor,
                    templateDef,
                    uploadedImages,
                });
                const hasCachedPreviews = Object.keys(previewItemsBySceneRef.current).length > 0;
                const hasMatchingBuildSignature = previewBuildSignatureRef.current === nextBuildSignature;

                if (canUseMockupPreviewApi(templateDef)) {
                    const liveCanvasBySurface = activeSurface
                        ? { [activeSurface]: canvasRef.current }
                        : {};
                    const basePayload = await buildMockupPreviewPayload({
                        templateDef,
                        surfaceDefs: orderedSurfaceDefs,
                        sceneDefs: orderedSceneDefs,
                        surfacePrintAreas,
                        snapshots,
                        liveCanvasBySurface,
                        shirtColor,
                        shirtColors,
                        uploadedImages,
                    });

                    if (!basePayload) {
                        throw new Error('Failed to build preview payload');
                    }

                    serverBasePayloadRef.current = basePayload;

                    if (hasMatchingBuildSignature && hasCachedPreviews) {
                        setSelectedScene((current) => (
                            orderedSceneDefs.some((scene) => scene.key === current)
                                ? current
                                : nextInitialSceneKey
                        ));
                        setIsLoading(false);
                        return;
                    }

                    previewItemsBySceneRef.current = {};
                    setPreviewItemsByScene({});
                    setSelectedScene((current) => (
                        orderedSceneDefs.some((scene) => scene.key === current)
                            ? current
                            : nextInitialSceneKey
                    ));
                    previewBuildSignatureRef.current = nextBuildSignature;
                    const thumbnailPayload = createMockupPreviewRequest(basePayload, {
                        size: THUMBNAIL_PREVIEW_SIZE,
                        responseType: 'json',
                    });
                    const response = await requestServerPreview(thumbnailPayload);
                    const items = mapApiPreviewItems({
                        response,
                        sceneDefs: orderedSceneDefs,
                        templateDef,
                    });
                    const nextPreviewItemsByScene = Object.fromEntries(
                        items.map((item) => [item.scene, item])
                    );

                    if (cancelled) {
                        return;
                    }

                    previewItemsBySceneRef.current = nextPreviewItemsByScene;
                    setPreviewItemsByScene(nextPreviewItemsByScene);
                    setSelectedScene((current) => (
                        items.some((item) => item.scene === current)
                            ? current
                            : items[0]?.scene || nextInitialSceneKey
                    ));
                    setIsLoading(false);
                    return;
                }

                if (hasMatchingBuildSignature && hasCachedPreviews) {
                    setSelectedScene((current) => (
                        orderedSceneDefs.some((scene) => scene.key === current)
                            ? current
                            : nextInitialSceneKey
                    ));
                    setIsLoading(false);
                    return;
                }

                previewItemsBySceneRef.current = {};
                setPreviewItemsByScene({});
                setSelectedScene((current) => (
                    orderedSceneDefs.some((scene) => scene.key === current)
                        ? current
                        : nextInitialSceneKey
                ));
                previewBuildSignatureRef.current = nextBuildSignature;

                const fallback = await buildClientPreviewItems({
                    surfaceDefs: orderedSurfaceDefs,
                    snapshots,
                    surfacePrintAreas,
                    shirtColor,
                    templateDef,
                });

                if (cancelled) {
                    fallback.objectUrls.forEach((url) => URL.revokeObjectURL(url));
                    return;
                }

                previewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
                previewObjectUrlsRef.current = fallback.objectUrls;
                const nextPreviewItemsByScene = Object.fromEntries(
                    fallback.items.map((item) => [item.scene, item])
                );
                previewItemsBySceneRef.current = nextPreviewItemsByScene;
                setPreviewItemsByScene(nextPreviewItemsByScene);
                setSelectedScene((current) => (
                    fallback.items.some((item) => item.scene === current)
                        ? current
                        : fallback.items[0]?.scene || nextInitialSceneKey
                ));
                setIsLoading(false);
            } catch (error) {
                if (!cancelled) {
                    setErrorMessage(error?.message || 'Failed to build preview');
                    setIsLoading(false);
                }
            }
        }

        buildPreviews();

        return () => {
            cancelled = true;
        };
    }, [
        isPreviewMode,
        activeSurface,
        canvasRef,
        captureSurfaceSnapshots,
        orderedSceneDefs,
        orderedSurfaceDefs,
        shirtColor,
        shirtColors,
        uploadedImages,
        surfacePrintAreas,
        templateDef,
    ]);

    async function ensureSceneFullPreview(sceneKey, expectedBuildSignature = previewBuildSignatureRef.current) {
        if (!sceneKey || !canUseMockupPreviewApi(templateDef)) {
            return previewItemsBySceneRef.current[sceneKey] || null;
        }

        const currentItem = previewItemsBySceneRef.current[sceneKey];
        if (!currentItem || currentItem.fullPreviewUrl || !serverBasePayloadRef.current) {
            return currentItem || null;
        }

        const fullPayload = createMockupPreviewRequest(serverBasePayloadRef.current, {
            sceneKeys: [sceneKey],
            responseType: 'binary',
            size: fullPreviewSize,
        });
        const response = await requestServerBinaryPreview(fullPayload);

        if (previewBuildSignatureRef.current !== expectedBuildSignature) {
            return previewItemsBySceneRef.current[sceneKey] || null;
        }

        const nextItem = {
            ...currentItem,
            fullPreviewUrl: response.objectUrl,
            hasFullResolution: true,
            fullMimeType: response.mimeType,
            fullSize: fullPreviewSize,
        };
        const nextPreviewItemsByScene = {
            ...previewItemsBySceneRef.current,
            [sceneKey]: nextItem,
        };

        previewItemsBySceneRef.current = nextPreviewItemsByScene;
        setPreviewItemsByScene(nextPreviewItemsByScene);
        return nextItem;
    }

    useEffect(() => {
        if (!isPreviewMode || !selectedScene || !canUseMockupPreviewApi(templateDef)) {
            setLoadingFullScene('');
            return undefined;
        }

        const selectedPreviewItem = previewItemsBySceneRef.current[selectedScene];
        if (!selectedPreviewItem || selectedPreviewItem.fullPreviewUrl) {
            setLoadingFullScene((current) => (current === selectedScene ? '' : current));
            return undefined;
        }

        let cancelled = false;
        const expectedBuildSignature = previewBuildSignatureRef.current;

        setLoadingFullScene(selectedScene);

        ensureSceneFullPreview(selectedScene, expectedBuildSignature)
            .catch((error) => {
                if (!cancelled && previewBuildSignatureRef.current === expectedBuildSignature) {
                    setErrorMessage(error?.message || 'Failed to load full-resolution preview');
                }
            })
            .finally(() => {
                if (!cancelled && previewBuildSignatureRef.current === expectedBuildSignature) {
                    setLoadingFullScene((current) => (current === selectedScene ? '' : current));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isPreviewMode, previewItemsByScene, selectedScene, templateDef, fullPreviewSize]);

    const previewItems = useMemo(
        () => orderedSceneDefs
            .map((sceneDef) => previewItemsByScene[sceneDef.key])
            .filter(Boolean),
        [orderedSceneDefs, previewItemsByScene]
    );

    const selectedItem = useMemo(
        () => previewItemsByScene[selectedScene] || previewItems[0] || null,
        [previewItems, previewItemsByScene, selectedScene]
    );
    const selectedItemFullPreviewUrl = selectedItem?.fullPreviewUrl || '';
    const isSelectedSceneAwaitingFullPreview = Boolean(
        selectedItem
        && selectedItem.source === 'server'
        && !selectedItem.fullPreviewUrl
    );
    const isSelectedSceneLoadingFullPreview = Boolean(
        isSelectedSceneAwaitingFullPreview
        && loadingFullScene === selectedItem?.scene
    );
    const shouldShowSelectedImage = Boolean(
        selectedItem
        && (
            selectedItem.source !== 'server'
            || selectedItem.fullPreviewUrl
        )
    );

    const handleDownload = async (item) => {
        if (!item) return;

        try {
            setDownloadScene(item.scene);
            setErrorMessage('');

            if (item.source === 'server') {
                const downloadableItem = item.fullPreviewUrl
                    ? item
                    : await ensureSceneFullPreview(item.scene);

                const downloadUrl = getPreviewDisplayUrl(downloadableItem || item);
                if (!downloadUrl) {
                    throw new Error('Full-resolution preview is unavailable');
                }

                triggerDownload(downloadUrl, item.filename);
                return;
            }

            const pngDataUrl = await rasterizePreviewSvg(item.svgMarkup, {
                width: item.width,
                height: item.height,
            });
            triggerDownload(pngDataUrl, item.filename);
        } catch (error) {
            setErrorMessage(error?.message || 'Failed to export preview');
        } finally {
            setDownloadScene('');
        }
    };

    const handleSaveProduct = async () => {
        setErrorMessage('');
        setSaveMessage('');
        const result = await saveProduct();
        if (!result?.ok) {
            setSaveMessage(result?.message || 'Save failed. Please try again.');
        }
    };

    return (
        <section className="preview-shell" id="preview-workspace">
            <div className="preview-viewer">
                <div className="preview-stage">
                    {isLoading && !selectedItem && (
                        <div className="preview-placeholder">
                            <Spinner />
                            <span>Rendering mockup...</span>
                        </div>
                    )}

                    {shouldShowSelectedImage && (
                        <>
                            <img
                                className="preview-stage-image"
                                src={selectedItem.source === 'server' ? selectedItemFullPreviewUrl : getPreviewDisplayUrl(selectedItem)}
                                alt={selectedItem.label}
                            />
                            {isSelectedSceneLoadingFullPreview && (
                                <div className="preview-placeholder">
                                    <Spinner />
                                    <span>Loading full-resolution preview...</span>
                                </div>
                            )}
                        </>
                    )}

                    {selectedItem && !shouldShowSelectedImage && (
                        <div className="preview-placeholder">
                            <Spinner />
                            <span>
                                {isSelectedSceneAwaitingFullPreview
                                    ? 'Loading full-resolution preview...'
                                    : 'Rendering mockup...'}
                            </span>
                        </div>
                    )}

                    {!isLoading && !selectedItem && (
                        <div className="preview-placeholder">
                            <span>No preview available.</span>
                        </div>
                    )}
                </div>
            </div>

            <aside className="preview-sidebar">
                <div className="preview-sidebar-header">
                    <div>
                        <h3>Mockup view</h3>
                        <p>Rendered previews are listed here. Select one to inspect it in full size.</p>
                    </div>
                </div>

                {errorMessage && <p className="preview-error preview-sidebar-message">{errorMessage}</p>}
                {saveMessage && <p className="preview-status preview-sidebar-message">{saveMessage}</p>}

                <div className="preview-thumb-grid">
                    {orderedSceneDefs.map((sceneDef) => {
                        const item = previewItemsByScene[sceneDef.key] || null;
                        const isActive = sceneDef.key === selectedScene;

                        return (
                            <button
                                key={sceneDef.key}
                                type="button"
                                className={`preview-thumb${isActive ? ' active' : ''}`}
                                onClick={() => setSelectedScene(sceneDef.key)}
                            >
                                <span className="preview-thumb-frame">
                                    {getPreviewDisplayUrl(item) ? (
                                        <img src={item?.thumbnailUrl || item?.previewUrl} alt={sceneDef.label} />
                                    ) : (
                                        <span className="preview-thumb-placeholder">
                                            {isLoading ? 'Loading...' : 'Open'}
                                        </span>
                                    )}
                                </span>
                                <span className="preview-thumb-label">{sceneDef.label}</span>
                            </button>
                        );
                    })}
                </div>
            </aside>

            <div className="preview-footer">
                <div className="preview-footer-left">
                    {selectedItem && (
                        <button
                            type="button"
                            className="preview-footer-btn preview-footer-download"
                            onClick={() => handleDownload(selectedItem)}
                            disabled={downloadScene === selectedItem.scene}
                        >
                            <DownloadIcon />
                            {downloadScene === selectedItem.scene ? 'Preparing download...' : 'Download mockup'}
                        </button>
                    )}
                </div>

                <div className="preview-footer-right">
                    <button
                        type="button"
                        className="preview-footer-btn preview-footer-save"
                        onClick={handleSaveProduct}
                        disabled={!hasDesignContent || isSavingProduct}
                    >
                        <SaveIcon />
                        {isSavingProduct ? 'Saving product...' : 'Save Product'}
                    </button>
                </div>
            </div>
        </section>
    );
}

function DownloadIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M4 20h16" />
        </svg>
    );
}

function SaveIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
        </svg>
    );
}

function Spinner() {
    return (
        <svg className="preview-spinner" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
        </svg>
    );
}
