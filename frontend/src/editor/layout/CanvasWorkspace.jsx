import { useEffect, useRef, useState } from 'react';
import { Canvas } from 'fabric';
import { useEditor } from './EditorContext';

const CANVAS_W = 360;
const CANVAS_H = 560;

export default function CanvasWorkspace() {
    const canvasElRef = useRef(null);
    const {
        setCanvas, syncLayers, setSelectedLayerId,
        activeSurface, surfaces, switchSurface,
        pushHistory, undo, redo,
        setSelectedObject,
        templateDef,
        shirtColor,
        isPreviewMode,
    } = useEditor();

    const [svgKey, setSvgKey] = useState(activeSurface);

    /* update SVG when surface changes */
    useEffect(() => { setSvgKey(activeSurface); }, [activeSurface]);

    const svgSrc = templateDef?.[activeSurface]?.svg;

    /* ── mount Fabric canvas ─────────────────────────────────── */
    useEffect(() => {
        const el = canvasElRef.current;
        if (!el) return;

        const canvas = new Canvas(el, {
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundColor: '#ffffff',
            selection: true,
        });

        const onSelected = () => {
            const active = canvas.getActiveObject();
            if (active?._layerId) setSelectedLayerId(active._layerId);
            setSelectedObject(active ?? null);
        };
        const onCleared = () => { setSelectedLayerId(null); setSelectedObject(null); };
        const onModified = () => { syncLayers(); pushHistory(); };
        const onTextChanged = () => { const a = canvas.getActiveObject(); setSelectedObject(a ?? null); };

        canvas.on('selection:created', onSelected);
        canvas.on('selection:updated', onSelected);
        canvas.on('selection:cleared', onCleared);
        canvas.on('object:modified', onModified);
        canvas.on('text:changed', onTextChanged);

        setCanvas(canvas);
        pushHistory();

        return () => {
            canvas.off('selection:created', onSelected);
            canvas.off('selection:updated', onSelected);
            canvas.off('selection:cleared', onCleared);
            canvas.off('object:modified', onModified);
            canvas.off('text:changed', onTextChanged);
            canvas.dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── keyboard shortcuts ──────────────────────────────────── */
    useEffect(() => {
        const onKey = (e) => {
            if (document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA' ||
                document.activeElement?.tagName === 'SELECT') return;
            const ctrl = e.ctrlKey || e.metaKey;
            if (!ctrl) return;
            if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undo(); }
            else if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); redo(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [undo, redo]);

    return (
        <div className={`cw-root${isPreviewMode ? ' preview' : ''}`} id="canvas-workspace">
            {/* T-shirt SVG template */}
            <div className="cw-stage">
                <div className="shirt-wrapper">
                    {/* Colorized shirt */}
                    {svgSrc && (
                        <div
                            className="shirt-svg-wrap"
                            key={svgKey}
                            style={{ '--shirt-color': shirtColor }}
                        >
                            <object
                                data={svgSrc}
                                type="image/svg+xml"
                                className="shirt-svg-obj"
                                aria-label="T-shirt template"
                            />
                            {/* Color overlay */}
                            <div
                                className="shirt-color-overlay"
                                style={{ background: shirtColor, opacity: shirtColor === '#FFFFFF' ? 0.12 : 0.45 }}
                            />
                        </div>
                    )}

                    {/* Print area (Fabric canvas) */}
                    <div className="print-area" id="print-area">
                        {!isPreviewMode && (
                            <span className="print-area-badge">PRINT AREA</span>
                        )}
                        <canvas ref={canvasElRef} />
                    </div>
                </div>
            </div>

            {/* Surface switcher */}
            <div className="cw-bottom-bar">
                <div className="surface-tabs" id="surface-tabs">
                    {surfaces.map((s) => (
                        <button
                            key={s}
                            className={`surface-tab${s === activeSurface ? ' active' : ''}`}
                            id={`surface-tab-${s}`}
                            onClick={() => switchSurface(s)}
                        >
                            {s === 'front' ? 'Front side' : 'Back side'}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
