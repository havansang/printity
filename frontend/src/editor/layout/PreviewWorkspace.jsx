import { useEffect, useMemo, useState } from 'react';
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
    } = useEditor();

    const [previewItems, setPreviewItems] = useState([]);
    const [selectedSurface, setSelectedSurface] = useState(surfaceDefs[0]?.key || '');
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [downloadSurface, setDownloadSurface] = useState('');
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
        let cancelled = false;
        let objectUrls = [];

        async function buildPreviews() {
            setIsLoading(true);
            setErrorMessage('');
            setSaveMessage('');

            try {
                const snapshots = captureSurfaceSnapshots();

                if (canUseMockupPreviewApi(templateDef)) {
                    const orderedSurfaceDefs = getOrderedSurfaceDefs(surfaceDefs);
                    const loadedItems = [];

                    setPreviewItems([]);

                    for (const surfaceDef of orderedSurfaceDefs) {
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
                            continue;
                        }

                        const response = await previewMockups(payload);
                        const items = mapApiPreviewItems({
                            response,
                            surfaceDefs,
                            templateDef,
                        });

                        if (cancelled) return;

                        if (items[0]) {
                            loadedItems.push(items[0]);
                            setPreviewItems([...loadedItems]);
                            setSelectedSurface((current) => (
                                loadedItems.some((item) => item.surface === current)
                                    ? current
                                    : loadedItems[0]?.surface || surfaceDefs[0]?.key || ''
                            ));
                        }
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

                objectUrls = fallback.objectUrls;
                setPreviewItems(fallback.items);
                setSelectedSurface((current) => (
                    fallback.items.some((item) => item.surface === current)
                        ? current
                        : fallback.items[0]?.surface || surfaceDefs[0]?.key || ''
                ));
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
            objectUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [
        captureSurfaceSnapshots,
        shirtColor,
        shirtColors,
        uploadedImages,
        surfaceDefs,
        surfacePrintAreas,
        templateDef,
    ]);

    const selectedItem = useMemo(
        () => previewItems.find((item) => item.surface === selectedSurface) || previewItems[0] || null,
        [previewItems, selectedSurface]
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
                    {!selectedItem && isLoading && (
                        <div className="preview-placeholder">
                            <Spinner />
                            <span>Rendering mockups...</span>
                        </div>
                    )}

                    {selectedItem && (
                        <img
                            className="preview-stage-image"
                            src={selectedItem.previewUrl}
                            alt={selectedItem.label}
                        />
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
                    {previewItems.map((item) => {
                        const isActive = item.surface === selectedSurface;

                        return (
                            <button
                                key={item.surface}
                                type="button"
                                className={`preview-thumb${isActive ? ' active' : ''}`}
                                onClick={() => setSelectedSurface(item.surface)}
                            >
                                <span className="preview-thumb-frame">
                                    <img src={item.previewUrl} alt={item.label} />
                                </span>
                                <span className="preview-thumb-label">{item.label}</span>
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
