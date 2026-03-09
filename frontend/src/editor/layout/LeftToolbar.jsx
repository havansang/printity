import { useRef, useState } from 'react';
import { useEditor } from './EditorContext';

const GOOGLE_FONTS = [
    'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato',
    'Poppins', 'Raleway', 'Ubuntu', 'Playfair Display', 'Merriweather',
    'Oswald', 'Nunito', 'PT Sans', 'Source Sans Pro', 'Lora',
    'Dancing Script', 'Pacifico', 'Caveat', 'Abril Fatface', 'Bebas Neue',
];

const SHAPES = [
    { type: 'Star', icon: <StarSVG /> },
    { type: 'Heart', icon: <HeartSVG /> },
    { type: 'Underline', icon: <UnderlineSVG /> },
    { type: 'Triangle', icon: <TriangleSVG /> },
    { type: 'Circle', icon: <CircleSVG /> },
    { type: 'Square', icon: <SquareSVG /> },
];

export default function LeftToolbar() {
    const { addText, addImage, addImageFromDataUrl, addShape, uploadedImages } = useEditor();
    const fileInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [fontSearch, setFontSearch] = useState('');

    const toggleTab = (tab) => setActiveTab((p) => (p === tab ? null : tab));

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) { addImage(file); e.target.value = ''; }
    };

    const handleDrop = (e) => {
        e.preventDefault(); setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) addImage(file);
    };

    const filteredFonts = GOOGLE_FONTS.filter((f) =>
        f.toLowerCase().includes(fontSearch.toLowerCase())
    );

    return (
        <aside className={`left-sidebar${activeTab ? ' expanded' : ''}`} id="left-toolbar">
            {/* Icon rail */}
            <div className="lt-rail">
                <RailBtn id="rail-upload" label="Upload" icon={<UploadIcon />} active={activeTab === 'upload'} onClick={() => toggleTab('upload')} />
                <RailBtn id="rail-text" label="Text" icon={<TextIcon />} active={activeTab === 'text'} onClick={() => toggleTab('text')} />
                <RailBtn id="rail-library" label="Library" icon={<LibIcon />} active={activeTab === 'library'} onClick={() => toggleTab('library')} />
                <RailBtn id="rail-shapes" label="Graphics" icon={<ShapesIcon />} active={activeTab === 'shapes'} onClick={() => toggleTab('shapes')} />
            </div>

            {/* Slide-out panel */}
            {activeTab && (
                <div className="lt-panel" id="lt-panel">

                    {/* ── Upload ── */}
                    {activeTab === 'upload' && (
                        <>
                            <div className="lt-panel-hdr">
                                <span>Upload</span>
                                <button className="lt-close" onClick={() => setActiveTab(null)}>✕</button>
                            </div>
                            <div className="lt-panel-body">
                                <div
                                    className={`drop-zone${isDragging ? ' over' : ''}`}
                                    id="drop-zone"
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <p className="dz-txt">My Device</p>
                                    <p className="dz-sub">JPG · PNG · SVG · max 100 MiB</p>
                                </div>
                                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.svg" style={{ display: 'none' }} onChange={handleFileChange} />
                            </div>
                        </>
                    )}

                    {/* ── Add Text ── */}
                    {activeTab === 'text' && (
                        <>
                            <div className="lt-panel-hdr">
                                <span>Add Text</span>
                                <button className="lt-close" onClick={() => setActiveTab(null)}>✕</button>
                            </div>
                            <div className="lt-panel-body">
                                <input
                                    className="font-search"
                                    id="font-search"
                                    type="search"
                                    placeholder="Search fonts…"
                                    value={fontSearch}
                                    onChange={(e) => setFontSearch(e.target.value)}
                                />
                                <div className="font-list">
                                    {filteredFonts.map((font) => (
                                        <button
                                            key={font}
                                            className="font-item"
                                            id={`font-${font.replace(/\s/g, '-').toLowerCase()}`}
                                            onClick={() => addText(`${font}, sans-serif`)}
                                            title={`Add text in ${font}`}
                                        >
                                            <span className="font-preview" style={{ fontFamily: `${font}, sans-serif` }}>Aa</span>
                                            <span className="font-name">{font}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── Library ── */}
                    {activeTab === 'library' && (
                        <>
                            <div className="lt-panel-hdr">
                                <span>Library</span>
                                <button className="lt-close" onClick={() => setActiveTab(null)}>✕</button>
                            </div>
                            <div className="lt-panel-body">
                                {uploadedImages.length === 0 ? (
                                    <p className="lib-empty">No uploads yet. Use the Upload tool to add images.</p>
                                ) : (
                                    <div className="lib-grid">
                                        {uploadedImages.map((img) => (
                                            <button
                                                key={img.id}
                                                className="lib-thumb"
                                                id={`lib-img-${img.id}`}
                                                title={img.name}
                                                onClick={() => addImageFromDataUrl(img.dataUrl, img.name)}
                                            >
                                                <img src={img.dataUrl} alt={img.name} />
                                                <span>{img.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── Graphics ── */}
                    {activeTab === 'shapes' && (
                        <>
                            <div className="lt-panel-hdr">
                                <span>Graphics</span>
                                <button className="lt-close" onClick={() => setActiveTab(null)}>✕</button>
                            </div>
                            <div className="lt-panel-body">
                                <div className="shapes-grid">
                                    {SHAPES.map((s) => (
                                        <button
                                            key={s.type}
                                            className="shape-tile"
                                            id={`shape-${s.type.toLowerCase()}`}
                                            title={s.type}
                                            onClick={() => addShape(s.type)}
                                        >
                                            {s.icon}
                                            <span>{s.type}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </aside>
    );
}

/* Rail button */
function RailBtn({ id, label, icon, active, onClick }) {
    return (
        <button className={`lt-rail-btn${active ? ' active' : ''}`} id={id} title={label} onClick={onClick}>
            {icon}
            <span>{label}</span>
        </button>
    );
}

/* Shape SVGs */
function StarSVG() { return <svg width="26" height="26" viewBox="0 0 32 32"><polygon points="16,2 19.8,12.2 30.5,12.2 21.9,18.8 25,29 16,22.8 7,29 10.1,18.8 1.5,12.2 12.2,12.2" fill="#4169E1" /></svg>; }
function HeartSVG() { return <svg width="26" height="26" viewBox="0 0 32 32"><path d="M16 28S3 20 3 11.5A7.5 7.5 0 0 1 16 7a7.5 7.5 0 0 1 13 4.5C29 20 16 28 16 28z" fill="#e74c3c" /></svg>; }
function UnderlineSVG() { return <svg width="26" height="26" viewBox="0 0 32 32"><rect x="4" y="22" width="24" height="4" rx="2" fill="#4169E1" /></svg>; }
function TriangleSVG() { return <svg width="26" height="26" viewBox="0 0 32 32"><polygon points="16,4 30,28 2,28" fill="#27ae60" /></svg>; }
function CircleSVG() { return <svg width="26" height="26" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#8e44ad" /></svg>; }
function SquareSVG() { return <svg width="26" height="26" viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="4" fill="#e67e22" /></svg>; }

/* Rail icons */
function UploadIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>; }
function TextIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>; }
function LibIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>; }
function ShapesIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polygon points="12,3 14.5,9.5 21,9.5 16,14 18,21 12,17 6,21 8,14 3,9.5 9.5,9.5" /></svg>; }
