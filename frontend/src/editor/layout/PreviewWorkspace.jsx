import { useEffect, useMemo, useState } from 'react';
import { useEditor } from './EditorContext';
import {
    buildSurfacePreview,
    createSvgObjectUrl,
    rasterizePreviewSvg,
} from './previewUtils';

const PREVIEW_SURFACES = ['front', 'back'];

function triggerDownload(href, filename) {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
}

export default function PreviewWorkspace() {
    const {
        templateDef,
        shirtColor,
        surfacePrintAreas,
        captureSurfaceSnapshots,
        saveProduct,
    } = useEditor();

    const [previewItems, setPreviewItems] = useState([]);
    const [selectedSurface, setSelectedSurface] = useState('front');
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [downloadSurface, setDownloadSurface] = useState('');
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
        let cancelled = false;
        const objectUrls = [];

        async function buildPreviews() {
            setIsLoading(true);
            setErrorMessage('');
            setSaveMessage('');

            try {
                const snapshots = captureSurfaceSnapshots();
                const items = await Promise.all(PREVIEW_SURFACES.map(async (surface) => {
                    const source = templateDef?.[surface]?.svg;
                    if (!source) return null;

                    const response = await fetch(source);
                    if (!response.ok) {
                        throw new Error(`Failed to load ${surface} template`);
                    }

                    const svgText = await response.text();
                    const preview = await buildSurfacePreview({
                        surface,
                        svgText,
                        snapshot: snapshots?.[surface],
                        printArea: surfacePrintAreas?.[surface],
                        shirtColor,
                    });

                    const previewUrl = createSvgObjectUrl(preview.svgMarkup);
                    objectUrls.push(previewUrl);

                    return {
                        surface,
                        label: surface === 'front' ? 'Front side' : 'Back side',
                        filename: `tshirt-${surface}-preview.png`,
                        previewUrl,
                        ...preview,
                    };
                }));

                if (cancelled) return;

                const filtered = items.filter(Boolean);
                setPreviewItems(filtered);
                setSelectedSurface((current) => (
                    filtered.some((item) => item.surface === current)
                        ? current
                        : filtered[0]?.surface || 'front'
                ));
            } catch (error) {
                if (!cancelled) setErrorMessage(error?.message || 'Failed to build preview');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        buildPreviews();

        return () => {
            cancelled = true;
            objectUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [captureSurfaceSnapshots, shirtColor, surfacePrintAreas, templateDef]);

    const selectedItem = useMemo(
        () => previewItems.find((item) => item.surface === selectedSurface) || previewItems[0] || null,
        [previewItems, selectedSurface]
    );

    const handleDownload = async (item) => {
        if (!item) return;

        try {
            setDownloadSurface(item.surface);
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

    const handleSaveProduct = () => {
        const result = saveProduct();
        if (result?.ok) {
            const savedAt = new Date(result.payload.savedAt).toLocaleString();
            setSaveMessage(`Saved locally at ${savedAt}`);
            return;
        }

        setSaveMessage('Save failed. Check browser storage availability.');
    };

    return (
        <section className="preview-shell" id="preview-workspace">
            <div className="preview-viewer">
                <div className="preview-stage">
                    {isLoading && (
                        <div className="preview-placeholder">
                            <Spinner />
                            <span>Building previews...</span>
                        </div>
                    )}

                    {!isLoading && !errorMessage && selectedItem && (
                        <img
                            className="preview-stage-image"
                            src={selectedItem.previewUrl}
                            alt={selectedItem.label}
                        />
                    )}

                    {!isLoading && !errorMessage && !selectedItem && (
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
                        <p>Select a thumbnail to show it on the left.</p>
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
                            className="preview-footer-btn preview-footer-download"
                            onClick={() => handleDownload(selectedItem)}
                            disabled={downloadSurface === selectedItem.surface}
                        >
                            <DownloadIcon />
                            {downloadSurface === selectedItem.surface ? 'Rendering mockup...' : 'Download mockup'}
                        </button>
                    )}
                </div>

                <div className="preview-footer-right">
                    <button className="preview-footer-btn preview-footer-save" onClick={handleSaveProduct}>
                        <SaveIcon />
                        Save Product
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
