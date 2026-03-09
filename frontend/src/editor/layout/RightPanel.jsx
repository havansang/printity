import { useState, useRef, useCallback } from 'react';
import { useEditor, SHIRT_COLORS } from './EditorContext';

const ALIGN_TOOLS = [
    { key: 'left', label: 'Align Left', icon: <AlignHLeft /> },
    { key: 'right', label: 'Align Right', icon: <AlignHRight /> },
    { key: 'top', label: 'Align Top', icon: <AlignVTop /> },
    { key: 'bottom', label: 'Align Bottom', icon: <AlignVBottom /> },
    { key: 'centerH', label: 'Center Horizontal', icon: <CenterH /> },
    { key: 'centerV', label: 'Center Vertical', icon: <CenterV /> },
];

export default function RightPanel() {
    const {
        layers, selectedLayerId, selectLayer, deleteLayer, reorderLayers,
        updateObjectTransform, alignObject,
        shirtColor, setShirtColor,
        canvasRef, selectedObjectType,
    } = useEditor();

    const [rpTab, setRpTab] = useState('layers');
    const [expandedId, setExpandedId] = useState(null);

    /* drag state */
    const [dragIdx, setDragIdx] = useState(null);
    const [hoverIdx, setHoverIdx] = useState(null);
    const listRef = useRef(null);
    const startY = useRef(0);
    const didDrag = useRef(false);

    const visualLayers = [...layers].reverse();
    const selectedLayer = layers.find((l) => l.id === selectedLayerId);

    const getObjProps = (id) => {
        const canvas = canvasRef?.current;
        if (!canvas) return {};
        const obj = canvas.getObjects().find((o) => o._layerId === id);
        if (!obj) return {};
        return {
            angle: Math.round(obj.angle ?? 0),
            left: Math.round(obj.left ?? 0),
            top: Math.round(obj.top ?? 0),
            scaleX: +(obj.scaleX ?? 1).toFixed(2),
            scaleY: +(obj.scaleY ?? 1).toFixed(2),
            width: Math.round((obj.width ?? 100) * (obj.scaleX ?? 1)),
            height: Math.round((obj.height ?? 100) * (obj.scaleY ?? 1)),
            fill: obj.fill ?? '#000000',
            opacity: Math.round((obj.opacity ?? 1) * 100),
        };
    };

    const handlePointerDown = useCallback((e, idx) => {
        if (e.target.closest('.rp-del-btn')) return;
        e.preventDefault();
        startY.current = e.clientY;
        didDrag.current = false;
        setDragIdx(idx);

        const onMove = (me) => {
            if (Math.abs(me.clientY - startY.current) > 4) didDrag.current = true;
            if (listRef.current) {
                const items = listRef.current.querySelectorAll('.rp-layer-row');
                for (let i = 0; i < items.length; i++) {
                    const r = items[i].getBoundingClientRect();
                    if (me.clientY >= r.top && me.clientY <= r.bottom) { setHoverIdx(i); break; }
                }
            }
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            setDragIdx((dIdx) => {
                setHoverIdx((hIdx) => {
                    if (didDrag.current && dIdx !== null && hIdx !== null && dIdx !== hIdx)
                        reorderLayers(dIdx, hIdx);
                    return null;
                });
                return null;
            });
            didDrag.current = false;
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, [reorderLayers]);

    return (
        <aside className="right-panel" id="right-panel">
            {/* ── Shirt Color ──────────────────────────────── */}
            <section className="rp-section rp-colors" id="rp-colors">
                <div className="rp-sec-hdr">Product Color</div>
                <div className="color-swatch-grid">
                    {SHIRT_COLORS.map((c) => (
                        <button
                            key={c.hex}
                            className={`color-swatch${shirtColor === c.hex ? ' sel' : ''}`}
                            id={`color-${c.name.replace(/\s/g, '-').toLowerCase()}`}
                            style={{ background: c.hex, border: c.hex === '#FFFFFF' ? '1px solid #ddd' : 'none' }}
                            title={c.name}
                            onClick={() => setShirtColor(c.hex)}
                        />
                    ))}
                </div>
            </section>

            {/* ── Tabs ─────────────────────────────────────── */}
            <div className="rp-tabs" id="rp-tabs">
                <button className={`rp-tab${rpTab === 'layers' ? ' active' : ''}`} id="tab-layers" onClick={() => setRpTab('layers')}>Layers</button>
            </div>

            {/* ── Layers list ──────────────────────────────── */}
            <div className="rp-layer-list" id="rp-layer-list">
                {layers.length === 0 && (
                    <p className="rp-empty">No layers. Add text or shapes.</p>
                )}
                <ul ref={listRef} className="rp-layer-ul">
                    {visualLayers.map((layer, idx) => {
                        const isExpanded = expandedId === layer.id;
                        const isSelected = layer.id === selectedLayerId;
                        let dropCls = '';
                        if (dragIdx !== null && hoverIdx !== null && hoverIdx === idx && dragIdx !== idx)
                            dropCls = dragIdx < idx ? ' drop-below' : ' drop-above';

                        const props = isExpanded ? getObjProps(layer.id) : {};

                        return (
                            <li
                                key={layer.id}
                                className={`rp-layer-row${isSelected ? ' selected' : ''}${dragIdx === idx ? ' dragging' : ''}${dropCls}`}
                                id={`layer-${layer.id}`}
                            >
                                {/* Row header */}
                                <div
                                    className="rp-layer-hdr"
                                    onClick={() => {
                                        if (!didDrag.current) {
                                            selectLayer(layer.id);
                                            setExpandedId(isExpanded ? null : layer.id);
                                        }
                                    }}
                                    onPointerDown={(e) => handlePointerDown(e, idx)}
                                >
                                    <span className="rp-drag-handle" title="Drag to reorder">
                                        <DragDots />
                                    </span>
                                    <span className="rp-layer-icon">
                                        {layer.type === 'text' && <TextLayerIco />}
                                        {layer.type === 'image' && <ImgLayerIco />}
                                        {layer.type === 'shape' && <ShapeLayerIco />}
                                    </span>
                                    <span className="rp-layer-name" title={layer.name}>{layer.name}</span>
                                    <span className={`rp-chevron${isExpanded ? ' open' : ''}`}>▾</span>
                                    <button className="rp-del-btn" title="Delete" onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}>
                                        <DelIco />
                                    </button>
                                </div>

                                {/* Accordion body */}
                                {isExpanded && (
                                    <div className="rp-layer-body" id={`layer-body-${layer.id}`}>
                                        {/* Common: Rotation */}
                                        <PropRow label="Rotate">
                                            <div className="prop-flex">
                                                <input
                                                    type="range" min="-180" max="180" step="1"
                                                    className="prop-range" id={`prop-angle-${layer.id}`}
                                                    value={props.angle ?? 0}
                                                    onChange={(e) => updateObjectTransform(layer.id, { angle: Number(e.target.value) })}
                                                />
                                                <input
                                                    type="number" min="-180" max="180"
                                                    className="prop-num" id={`prop-angle-num-${layer.id}`}
                                                    value={props.angle ?? 0}
                                                    onChange={(e) => updateObjectTransform(layer.id, { angle: Number(e.target.value) })}
                                                />
                                                <span className="prop-unit">°</span>
                                            </div>
                                        </PropRow>

                                        {/* Position */}
                                        <PropRow label="Left">
                                            <div className="prop-flex">
                                                <input type="number" className="prop-num prop-num-wide" id={`prop-left-${layer.id}`}
                                                    value={props.left ?? 0} onChange={(e) => updateObjectTransform(layer.id, { left: Number(e.target.value) })} />
                                                <span className="prop-unit">px</span>
                                            </div>
                                        </PropRow>
                                        <PropRow label="Top">
                                            <div className="prop-flex">
                                                <input type="number" className="prop-num prop-num-wide" id={`prop-top-${layer.id}`}
                                                    value={props.top ?? 0} onChange={(e) => updateObjectTransform(layer.id, { top: Number(e.target.value) })} />
                                                <span className="prop-unit">px</span>
                                            </div>
                                        </PropRow>

                                        {/* Shape-specific: Color, Width, Height */}
                                        {layer.type === 'shape' && (
                                            <>
                                                <PropRow label="Color">
                                                    <input type="color" className="prop-color" id={`prop-color-${layer.id}`}
                                                        value={(props.fill ?? '#4169E1').startsWith('#') ? (props.fill) : '#4169E1'}
                                                        onChange={(e) => updateObjectTransform(layer.id, { fill: e.target.value })} />
                                                </PropRow>
                                                <PropRow label="Width">
                                                    <div className="prop-flex">
                                                        <input type="number" min="1" className="prop-num prop-num-wide" id={`prop-w-${layer.id}`}
                                                            value={props.width ?? 100}
                                                            onChange={(e) => {
                                                                const canvas = canvasRef?.current;
                                                                const obj = canvas?.getObjects().find(o => o._layerId === layer.id);
                                                                if (obj) updateObjectTransform(layer.id, { scaleX: Number(e.target.value) / (obj.width || 1) });
                                                            }} />
                                                        <span className="prop-unit">px</span>
                                                    </div>
                                                </PropRow>
                                                <PropRow label="Height">
                                                    <div className="prop-flex">
                                                        <input type="number" min="1" className="prop-num prop-num-wide" id={`prop-h-${layer.id}`}
                                                            value={props.height ?? 100}
                                                            onChange={(e) => {
                                                                const canvas = canvasRef?.current;
                                                                const obj = canvas?.getObjects().find(o => o._layerId === layer.id);
                                                                if (obj) updateObjectTransform(layer.id, { scaleY: Number(e.target.value) / (obj.height || 1) });
                                                            }} />
                                                        <span className="prop-unit">px</span>
                                                    </div>
                                                </PropRow>
                                            </>
                                        )}

                                        {/* Image-specific: Width, Height, Scale */}
                                        {layer.type === 'image' && (
                                            <>
                                                <PropRow label="Width">
                                                    <div className="prop-flex">
                                                        <input type="number" min="1" className="prop-num prop-num-wide" id={`prop-w-${layer.id}`} value={props.width ?? 100}
                                                            onChange={(e) => {
                                                                const canvas = canvasRef?.current;
                                                                const obj = canvas?.getObjects().find(o => o._layerId === layer.id);
                                                                if (obj) updateObjectTransform(layer.id, { scaleX: Number(e.target.value) / (obj.width || 1) });
                                                            }} />
                                                        <span className="prop-unit">px</span>
                                                    </div>
                                                </PropRow>
                                                <PropRow label="Height">
                                                    <div className="prop-flex">
                                                        <input type="number" min="1" className="prop-num prop-num-wide" id={`prop-h-${layer.id}`} value={props.height ?? 100}
                                                            onChange={(e) => {
                                                                const canvas = canvasRef?.current;
                                                                const obj = canvas?.getObjects().find(o => o._layerId === layer.id);
                                                                if (obj) updateObjectTransform(layer.id, { scaleY: Number(e.target.value) / (obj.height || 1) });
                                                            }} />
                                                        <span className="prop-unit">px</span>
                                                    </div>
                                                </PropRow>
                                            </>
                                        )}

                                        {/* Alignment (all types) */}
                                        <div className="prop-row">
                                            <span className="prop-label">Align</span>
                                            <div className="align-tools">
                                                {ALIGN_TOOLS.map((a) => (
                                                    <button key={a.key} className="align-btn" id={`align-${a.key}-${layer.id}`} title={a.label}
                                                        onClick={() => alignObject(a.key)}>
                                                        {a.icon}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </aside>
    );
}

function PropRow({ label, children }) {
    return (
        <div className="prop-row">
            <span className="prop-label">{label}</span>
            {children}
        </div>
    );
}

/* Icons */
function DragDots() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2" /><circle cx="16" cy="4" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="20" r="2" /><circle cx="16" cy="20" r="2" /></svg>; }
function TextLayerIco() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>; }
function ImgLayerIco() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>; }
function ShapeLayerIco() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /></svg>; }
function DelIco() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>; }
function AlignHLeft() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="3" y2="21" /><rect x="5" y="7" width="14" height="4" rx="1" /><rect x="5" y="13" width="8" height="4" rx="1" /></svg>; }
function AlignHRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="21" y1="3" x2="21" y2="21" /><rect x="5" y="7" width="14" height="4" rx="1" /><rect x="11" y="13" width="8" height="4" rx="1" /></svg>; }
function AlignVTop() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="21" y2="3" /><rect x="7" y="5" width="4" height="14" rx="1" /><rect x="13" y="5" width="4" height="8" rx="1" /></svg>; }
function AlignVBottom() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="21" x2="21" y2="21" /><rect x="7" y="5" width="4" height="14" rx="1" /><rect x="13" y="11" width="4" height="8" rx="1" /></svg>; }
function CenterH() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="3" x2="12" y2="21" /><rect x="4" y="9" width="16" height="6" rx="1" /></svg>; }
function CenterV() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12" /><rect x="9" y="4" width="6" height="16" rx="1" /></svg>; }
