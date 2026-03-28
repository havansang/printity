import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from './mockupPreviewPayload';
import { previewMockups } from '../../shared/api/mockupApi';

const SERVER_PREVIEW_RESPONSE_CACHE = new Map();
const SERVER_PREVIEW_REQUEST_CACHE = new Map();

function buildPreviewStateKey({
    orderedSurfaceDefs,
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
            surface,
            label: surfaceDef.label,
            filename: buildMockupFilename({
                templateDef,
                surfaceKey: surface,
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

function mapApiPreviewItems({ response, surfaceDefs, templateDef }) {
    const previews = Array.isArray(response?.data?.previews) ? response.data.previews : [];
    const labelsBySurface = new Map(surfaceDefs.map((surfaceDef) => [surfaceDef.key, surfaceDef.label]));
    const surfaceOrder = new Map(surfaceDefs.map((surfaceDef, index) => [surfaceDef.key, index]));

    return previews
        .map((preview) => ({
            source: 'server',
            surface: preview.surfaceKey,
            label: labelsBySurface.get(preview.surfaceKey) || preview.surfaceKey,
            filename: buildMockupFilename({
                templateDef,
                surfaceKey: preview.surfaceKey,
                format: response?.data?.format,
                mimeType: preview.mimeType,
            }),
            previewUrl: preview.dataUrl,
            dataUrl: preview.dataUrl,
            width: preview.width,
            height: preview.height,
            mimeType: preview.mimeType,
        }))
        .sort((left, right) => (
            (surfaceOrder.get(left.surface) ?? Number.MAX_SAFE_INTEGER)
            - (surfaceOrder.get(right.surface) ?? Number.MAX_SAFE_INTEGER)
        ));
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
            SERVER_PREVIEW_RESPONSE_CACHE.set(requestKey, response);
            return response;
        })
        .finally(() => {
            SERVER_PREVIEW_REQUEST_CACHE.delete(requestKey);
        });

    SERVER_PREVIEW_REQUEST_CACHE.set(requestKey, request);
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

export default function PreviewWorkspace() {
    const {
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
    const initialSurfaceKey = orderedSurfaceDefs[0]?.key || '';
    const [previewItemsBySurface, setPreviewItemsBySurface] = useState({});
    const previewItemsBySurfaceRef = useRef({});
    const previewSessionRef = useRef({ id: 0, snapshots: null });
    const previewObjectUrlsRef = useRef([]);
    const previewBuildSignatureRef = useRef('');
    const [selectedSurface, setSelectedSurface] = useState(initialSurfaceKey);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingSurface, setLoadingSurface] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [downloadSurface, setDownloadSurface] = useState('');
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
        previewItemsBySurfaceRef.current = previewItemsBySurface;
    }, [previewItemsBySurface]);

    useEffect(() => (
        () => {
            previewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            previewObjectUrlsRef.current = [];
        }
    ), []);

    const loadServerSurfacePreview = useCallback(async (surfaceKey, snapshotsOverride = null, sessionIdOverride = null) => {
        const snapshots = snapshotsOverride || previewSessionRef.current.snapshots;
        const sessionId = sessionIdOverride ?? previewSessionRef.current.id;
        const surfaceDef = orderedSurfaceDefs.find((surface) => surface.key === surfaceKey);

        if (!surfaceKey || !surfaceDef || !snapshots) {
            return null;
        }

        if (previewItemsBySurfaceRef.current[surfaceKey]) {
            return previewItemsBySurfaceRef.current[surfaceKey];
        }

        const payload = await buildMockupPreviewPayload({
            templateDef,
            surfaceDef,
            surfacePrintAreas,
            snapshots,
            shirtColor,
            shirtColors,
            uploadedImages,
        });

        if (!payload) {
            return null;
        }

        setLoadingSurface(surfaceKey);

        try {
            const response = await requestServerPreview(payload);
            const item = mapApiPreviewItems({
                response,
                surfaceDefs,
                templateDef,
            })[0] || null;

            if (previewSessionRef.current.id !== sessionId || !item) {
                return item;
            }

            setPreviewItemsBySurface((current) => {
                if (current[surfaceKey]) {
                    return current;
                }

                return {
                    ...current,
                    [surfaceKey]: item,
                };
            });

            return item;
        } finally {
            if (previewSessionRef.current.id === sessionId) {
                setLoadingSurface((current) => (current === surfaceKey ? '' : current));
            }
        }
    }, [
        orderedSurfaceDefs,
        shirtColor,
        shirtColors,
        surfaceDefs,
        surfacePrintAreas,
        templateDef,
        uploadedImages,
    ]);

    useEffect(() => {
        if (!isPreviewMode) {
            return undefined;
        }

        let cancelled = false;

        async function buildPreviews() {
            setIsLoading(true);
            setErrorMessage('');
            setSaveMessage('');

            try {
                const snapshots = captureSurfaceSnapshots();
                const nextInitialSurfaceKey = orderedSurfaceDefs[0]?.key || '';
                const nextBuildSignature = buildPreviewStateKey({
                    orderedSurfaceDefs,
                    snapshots,
                    surfacePrintAreas,
                    shirtColor,
                    templateDef,
                    uploadedImages,
                });
                const hasCachedPreviews = Object.keys(previewItemsBySurfaceRef.current).length > 0;

                if (previewBuildSignatureRef.current === nextBuildSignature && hasCachedPreviews) {
                    setSelectedSurface((current) => (
                        orderedSurfaceDefs.some((surface) => surface.key === current)
                            ? current
                            : nextInitialSurfaceKey
                    ));
                    setIsLoading(false);
                    return;
                }

                previewBuildSignatureRef.current = nextBuildSignature;

                if (canUseMockupPreviewApi(templateDef)) {
                    const nextSessionId = previewSessionRef.current.id + 1;
                    previewSessionRef.current = {
                        id: nextSessionId,
                        snapshots,
                    };
                    previewItemsBySurfaceRef.current = {};
                    setPreviewItemsBySurface({});
                    setSelectedSurface((current) => (
                        orderedSurfaceDefs.some((surface) => surface.key === current)
                            ? current
                            : nextInitialSurfaceKey
                    ));

                    if (nextInitialSurfaceKey) {
                        await loadServerSurfacePreview(nextInitialSurfaceKey, snapshots, nextSessionId);
                        if (!cancelled && previewSessionRef.current.id === nextSessionId) {
                            setIsLoading(false);
                        }

                        for (const surfaceDef of orderedSurfaceDefs) {
                            if (surfaceDef.key === nextInitialSurfaceKey) {
                                continue;
                            }

                            if (cancelled || previewSessionRef.current.id !== nextSessionId) {
                                break;
                            }

                            await loadServerSurfacePreview(surfaceDef.key, snapshots, nextSessionId);
                        }
                    } else if (!cancelled) {
                        setIsLoading(false);
                    }
                    return;
                }

                const fallback = await buildClientPreviewItems({
                    surfaceDefs,
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
                const nextPreviewItemsBySurface = Object.fromEntries(
                    fallback.items.map((item) => [item.surface, item])
                );
                previewItemsBySurfaceRef.current = nextPreviewItemsBySurface;
                setPreviewItemsBySurface(nextPreviewItemsBySurface);
                setSelectedSurface((current) => (
                    fallback.items.some((item) => item.surface === current)
                        ? current
                        : fallback.items[0]?.surface || nextInitialSurfaceKey
                ));
                setIsLoading(false);
            } catch (error) {
                if (!cancelled) {
                    setErrorMessage(error?.message || 'Failed to build preview');
                }
            } finally {
                if (!cancelled) {
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
        captureSurfaceSnapshots,
        loadServerSurfacePreview,
        orderedSurfaceDefs,
        shirtColor,
        shirtColors,
        uploadedImages,
        surfacePrintAreas,
        templateDef,
    ]);

    useEffect(() => {
        if (!isPreviewMode) {
            return;
        }

        if (!canUseMockupPreviewApi(templateDef)) {
            return;
        }

        if (!selectedSurface || previewItemsBySurface[selectedSurface] || !previewSessionRef.current.snapshots) {
            return;
        }

        void loadServerSurfacePreview(selectedSurface);
    }, [isPreviewMode, loadServerSurfacePreview, previewItemsBySurface, selectedSurface, templateDef]);

    const previewItems = useMemo(
        () => orderedSurfaceDefs
            .map((surfaceDef) => previewItemsBySurface[surfaceDef.key])
            .filter(Boolean),
        [orderedSurfaceDefs, previewItemsBySurface]
    );

    const selectedItem = useMemo(
        () => previewItemsBySurface[selectedSurface] || previewItems[0] || null,
        [previewItems, previewItemsBySurface, selectedSurface]
    );

    const handleDownload = async (item) => {
        if (!item) return;

        try {
            setDownloadSurface(item.surface);
            setErrorMessage('');

            if (item.dataUrl) {
                triggerDownload(item.dataUrl, item.filename);
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
            setDownloadSurface('');
        }
    };

    const handleSaveProduct = async () => {
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
                    {!selectedItem && (isLoading || loadingSurface === selectedSurface) && (
                        <div className="preview-placeholder">
                            <Spinner />
                            <span>Rendering mockup...</span>
                        </div>
                    )}

                    {selectedItem && (
                        <img
                            className="preview-stage-image"
                            src={selectedItem.previewUrl}
                            alt={selectedItem.label}
                        />
                    )}

                    {!isLoading && loadingSurface !== selectedSurface && !selectedItem && (
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
                    {orderedSurfaceDefs.map((surfaceDef) => {
                        const item = previewItemsBySurface[surfaceDef.key] || null;
                        const isActive = surfaceDef.key === selectedSurface;
                        const isPending = loadingSurface === surfaceDef.key;

                        return (
                            <button
                                key={surfaceDef.key}
                                type="button"
                                className={`preview-thumb${isActive ? ' active' : ''}`}
                                onClick={() => setSelectedSurface(surfaceDef.key)}
                            >
                                <span className="preview-thumb-frame">
                                    {item?.previewUrl ? (
                                        <img src={item.previewUrl} alt={surfaceDef.label} />
                                    ) : (
                                        <span className="preview-thumb-placeholder">
                                            {isPending ? 'Loading...' : 'Open'}
                                        </span>
                                    )}
                                </span>
                                <span className="preview-thumb-label">{surfaceDef.label}</span>
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
                            disabled={downloadSurface === selectedItem.surface}
                        >
                            <DownloadIcon />
                            {downloadSurface === selectedItem.surface ? 'Preparing download...' : 'Download mockup'}
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
