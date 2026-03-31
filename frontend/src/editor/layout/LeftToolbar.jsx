import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from './EditorContext';
import { pickEditorFontVariant } from './editorFonts';

const DEFAULT_SHAPE_COLOR_HEX = '#64634A';

export default function LeftToolbar() {
    const {
        addText,
        addImage,
        addImageFromDataUrl,
        deleteUploadedImage,
        addShape,
        uploadedImages,
        uploadedImagesLoading,
        uploadedImagesError,
        isUploadingImage,
        deletingAssetId,
        availableFonts,
        fontsLoading,
        fontsError,
        loadFontFamily,
        availableShapes,
        shapesLoading,
        shapesError,
        shapesLoaded,
        loadAvailableShapes,
    } = useEditor();

    const fileInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState(null);
    const [mountedTabs, setMountedTabs] = useState({});
    const [isDragging, setIsDragging] = useState(false);
    const [fontSearch, setFontSearch] = useState('');

    const toggleTab = (tab) => {
        setMountedTabs((previousTabs) => (
            previousTabs[tab]
                ? previousTabs
                : { ...previousTabs, [tab]: true }
        ));
        setActiveTab((previousTab) => (previousTab === tab ? null : tab));
    };

    const handleSelectedFile = async (file) => {
        if (!file) return;
        await addImage(file);
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (file) {
            await handleSelectedFile(file);
            event.target.value = '';
        }
    };

    const handleDrop = async (event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            await handleSelectedFile(file);
        }
    };

    const filteredFonts = useMemo(() => (
        availableFonts.filter((font) => font.family.toLowerCase().includes(fontSearch.toLowerCase()))
    ), [availableFonts, fontSearch]);

    useEffect(() => {
        if (activeTab !== 'shapes' || shapesLoaded || shapesLoading) return;
        void loadAvailableShapes();
    }, [activeTab, loadAvailableShapes, shapesLoaded, shapesLoading]);

    return (
        <aside className={`left-sidebar${activeTab ? ' expanded' : ''}`} id="left-toolbar">
            <div className="lt-rail">
                <RailBtn id="rail-upload" label="Upload" icon={<UploadIcon />} active={activeTab === 'upload'} onClick={() => toggleTab('upload')} />
                <RailBtn id="rail-text" label="Text" icon={<TextIcon />} active={activeTab === 'text'} onClick={() => toggleTab('text')} />
                <RailBtn id="rail-library" label="Library" icon={<LibIcon />} active={activeTab === 'library'} onClick={() => toggleTab('library')} />
                <RailBtn id="rail-shapes" label="Graphics" icon={<ShapesIcon />} active={activeTab === 'shapes'} onClick={() => toggleTab('shapes')} />
            </div>

            <div className="lt-panel" id="lt-panel" hidden={!activeTab} aria-hidden={!activeTab}>
                {mountedTabs.upload && (
                    <section hidden={activeTab !== 'upload'} aria-hidden={activeTab !== 'upload'}>
                        <>
                            <div className="lt-panel-hdr">
                                <span>Upload</span>
                                <button className="lt-close" onClick={() => setActiveTab(null)} aria-label="Close upload panel">
                                    <CloseIcon />
                                </button>
                            </div>
                            <div className="lt-panel-body">
                                <div
                                    className={`drop-zone${isDragging ? ' over' : ''}`}
                                    id="drop-zone"
                                    onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <p className="dz-txt">{isUploadingImage ? 'Uploading...' : 'My Device'}</p>
                                    <p className="dz-sub">JPG | PNG | SVG | max 100 MiB</p>
                                </div>
                                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.svg" style={{ display: 'none' }} onChange={handleFileChange} />
                                {uploadedImagesError && <p className="lib-empty">{uploadedImagesError}</p>}
                            </div>
                        </>
                    </section>
                )}

                {mountedTabs.text && (
                    <section hidden={activeTab !== 'text'} aria-hidden={activeTab !== 'text'}>
                        <>
                            <div className="lt-panel-hdr">
                                <span>Add Text</span>
                                <button className="lt-close" onClick={() => setActiveTab(null)} aria-label="Close text panel">
                                    <CloseIcon />
                                </button>
                            </div>
                            <div className="lt-panel-body">
                                <label className="font-search-wrap" htmlFor="font-search">
                                    <SearchIcon />
                                    <input
                                        className="font-search"
                                        id="font-search"
                                        type="search"
                                        placeholder="Search fonts..."
                                        value={fontSearch}
                                        onChange={(event) => setFontSearch(event.target.value)}
                                    />
                                </label>
                                {fontsLoading && <p className="lib-empty">Loading fonts from backend...</p>}
                                {!fontsLoading && fontsError && <p className="lib-empty">{fontsError}</p>}
                                <div className="font-list">
                                    {filteredFonts.map((font) => (
                                        <FontListItem
                                            key={font.family}
                                            font={font}
                                            addText={addText}
                                            loadFontFamily={loadFontFamily}
                                        />
                                    ))}
                                    {!fontsLoading && filteredFonts.length === 0 && (
                                        <p className="lib-empty">No fonts matched your search.</p>
                                    )}
                                </div>
                            </div>
                        </>
                    </section>
                )}

                {mountedTabs.library && (
                    <section hidden={activeTab !== 'library'} aria-hidden={activeTab !== 'library'}>
                        <>
                            <div className="lt-panel-hdr">
                                <span>Library</span>
                                <button className="lt-close" onClick={() => setActiveTab(null)} aria-label="Close library panel">
                                    <CloseIcon />
                                </button>
                            </div>
                            <div className="lt-panel-body">
                                {uploadedImagesLoading ? (
                                    <p className="lib-empty">Loading uploaded assets...</p>
                                ) : uploadedImagesError ? (
                                    <p className="lib-empty">{uploadedImagesError}</p>
                                ) : uploadedImages.length === 0 ? (
                                    <p className="lib-empty">No uploads yet. Use the Upload tool to add images.</p>
                                ) : (
                                    <div className="lib-grid">
                                        {uploadedImages.map((image) => (
                                            <div
                                                key={image.id}
                                                className="lib-thumb"
                                                id={`lib-img-${image.id}`}
                                            >
                                                <button
                                                    type="button"
                                                    className="lib-thumb-delete"
                                                    aria-label={`Delete ${image.originalName || image.name}`}
                                                    title={`Delete ${image.originalName || image.name}`}
                                                    disabled={deletingAssetId === image.id}
                                                    onClick={async (event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        await deleteUploadedImage(image.id);
                                                    }}
                                                >
                                                    <TrashIcon />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="lib-thumb-select"
                                                    title={image.originalName || image.name}
                                                    onClick={() => addImageFromDataUrl(image.renderUrl, image.name, {
                                                        assetId: image.id,
                                                        assetUrl: image.url,
                                                        sourceMimeType: image.mimeType || '',
                                                    })}
                                                >
                                                    <span className="lib-thumb-media">
                                                        <img src={image.renderUrl} alt={image.originalName || image.name} />
                                                    </span>
                                                    <span className="lib-thumb-label">{image.name}</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    </section>
                )}

                {mountedTabs.shapes && (
                    <section hidden={activeTab !== 'shapes'} aria-hidden={activeTab !== 'shapes'}>
                        <>
                            <div className="lt-panel-hdr">
                                <span>Graphics</span>
                                <button className="lt-close" onClick={() => setActiveTab(null)} aria-label="Close graphics panel">
                                    <CloseIcon />
                                </button>
                            </div>
                            <div className="lt-panel-body">
                                {shapesLoading ? (
                                    <p className="lib-empty">Loading graphics from backend...</p>
                                ) : shapesError ? (
                                    <p className="lib-empty">{shapesError}</p>
                                ) : availableShapes.length === 0 ? (
                                    <p className="lib-empty">No graphics available yet.</p>
                                ) : (
                                    <div className="shapes-grid">
                                        {availableShapes.map((shape) => (
                                            <button
                                                key={shape.id}
                                                className="shape-tile"
                                                id={`shape-${shape.slug}`}
                                                title={shape.name}
                                                onClick={() => addShape(shape)}
                                            >
                                                <ShapePreview shape={shape} />
                                                <span>{shape.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    </section>
                )}
            </div>
        </aside>
    );
}

function ShapePreview({ shape }) {
    if (shape.previewUrl) {
        return (
            <span className="shape-thumb-media">
                <img src={shape.previewUrl} alt={shape.name} loading="lazy" />
            </span>
        );
    }

    return (
        <svg
            className="shape-preview-svg"
            width="34"
            height="34"
            viewBox={`0 0 ${shape.geometry.defaultWidth} ${shape.geometry.defaultHeight}`}
            aria-hidden="true"
        >
            <path d={shape.geometry.pathCommands} fill={DEFAULT_SHAPE_COLOR_HEX} />
        </svg>
    );
}

function FontListItem({ font, addText, loadFontFamily }) {
    const itemRef = useRef(null);
    const [shouldLoadPreview, setShouldLoadPreview] = useState(false);

    const previewVariant = pickEditorFontVariant(font, {
        fontWeight: 400,
        fontStyle: 'normal',
    });
    const previewWeight = previewVariant?.fontWeight ?? 400;
    const previewStyle = previewVariant?.fontStyle ?? 'normal';
    const variantCount = font.variantCount || font.variants?.length || 0;

    useEffect(() => {
        const node = itemRef.current;
        if (!node || shouldLoadPreview) return undefined;

        if (typeof IntersectionObserver === 'undefined') {
            setShouldLoadPreview(true);
            return undefined;
        }

        const observer = new IntersectionObserver((entries) => {
            const isVisible = entries.some((entry) => entry.isIntersecting);
            if (!isVisible) return;

            setShouldLoadPreview(true);
            observer.disconnect();
        }, {
            rootMargin: '160px 0px',
        });

        observer.observe(node);
        return () => observer.disconnect();
    }, [shouldLoadPreview]);

    useEffect(() => {
        if (!shouldLoadPreview) return;

        void loadFontFamily(font.family, {
            fontWeight: previewWeight,
            fontStyle: previewStyle,
        });
    }, [font.family, loadFontFamily, previewStyle, previewWeight, shouldLoadPreview]);

    const triggerPreviewLoad = () => {
        setShouldLoadPreview(true);
        void loadFontFamily(font.family, {
            fontWeight: previewWeight,
            fontStyle: previewStyle,
        });
    };

    const handleAddText = () => {
        setShouldLoadPreview(true);
        void addText({
            family: font.family,
            fontWeight: previewWeight,
            fontStyle: previewStyle,
            variants: font.variants,
            category: font.category,
        });
    };

    return (
        <button
            ref={itemRef}
            className="font-item"
            id={`font-${font.family.replace(/\s/g, '-').toLowerCase()}`}
            onMouseEnter={triggerPreviewLoad}
            onFocus={triggerPreviewLoad}
            onClick={handleAddText}
            title={`Add text in ${font.family}`}
        >
            <span className="font-copy">
                <span
                    className="font-sample"
                    style={{
                        fontFamily: font.cssFamily,
                        fontWeight: previewWeight,
                        fontStyle: previewStyle,
                    }}
                >
                    {font.family}
                </span>
                {variantCount > 1 && (
                    <span className="font-meta">{variantCount} styles</span>
                )}
            </span>
        </button>
    );
}

function RailBtn({ id, label, icon, active, onClick }) {
    return (
        <button className={`lt-rail-btn${active ? ' active' : ''}`} id={id} title={label} onClick={onClick}>
            {icon}
            <span>{label}</span>
        </button>
    );
}

function UploadIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>; }
function TextIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>; }
function LibIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>; }
function ShapesIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polygon points="12,3 14.5,9.5 21,9.5 16,14 18,21 12,17 6,21 8,14 3,9.5 9.5,9.5" /></svg>; }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" /></svg>; }
function CloseIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>; }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>; }
