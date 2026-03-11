import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from 'fabric';
import { useEditor } from './EditorContext';
import Positioner from './Positioner';

const CANVAS_W = 360;
const CANVAS_H = 408;

export default function CanvasWorkspace() {
    const sceneRef = useRef(null);
    const svgRef = useRef(null);
    const canvasElRef = useRef(null);
    const fabricRef = useRef(null);
    const rafRef = useRef(null);
    const loadIdRef = useRef(0);
    const basePrintAreaRef = useRef({ x: 0, y: 0 });
    const pushHistoryRef = useRef(null);
    const syncLayersRef = useRef(null);

    const {
        setCanvas, syncLayers, setSelectedLayerId,
        activeSurface, surfaces, switchSurface,
        pushHistory, undo, redo,
        setSelectedObject,
        templateDef,
        shirtColor,
        isPreviewMode,
    } = useEditor();

    const [svgRevision, setSvgRevision] = useState(0);

    useEffect(() => {
        pushHistoryRef.current = pushHistory;
    }, [pushHistory]);

    useEffect(() => {
        syncLayersRef.current = syncLayers;
    }, [syncLayers]);

    const measurePrintArea = useCallback(() => {
        const sceneEl = sceneRef.current;
        const svgEl = svgRef.current;
        if (!sceneEl || !svgEl) return null;

        const placeholder = svgEl.querySelector(`#placeholder_${activeSurface}`);
        if (!placeholder) return null;

        const sceneRect = sceneEl.getBoundingClientRect();
        const printRect = placeholder.getBoundingClientRect();

        if (printRect.width <= 0 || printRect.height <= 0) return null;

        return {
            left: printRect.left - sceneRect.left,
            top: printRect.top - sceneRect.top,
            width: printRect.width,
            height: printRect.height,
        };
    }, [activeSurface]);

    const alignCanvasToPrintArea = useCallback(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const pa = measurePrintArea();
        if (!pa) return;

        const wrapper = canvas.wrapperEl;
        const sourceW = canvas.getWidth() || CANVAS_W;
        const sourceH = canvas.getHeight() || CANVAS_H;
        const scale = pa.width / sourceW;
        const renderH = sourceH * scale;
        const left = pa.left;
        const top = pa.top + (pa.height - renderH) / 2;

        wrapper.style.position = 'absolute';
        wrapper.style.left = `${left}px`;
        wrapper.style.top = `${top}px`;
        wrapper.style.transformOrigin = 'top left';
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.zIndex = '2';
    }, [measurePrintArea]);

    const syncViewportToPrintArea = useCallback(() => {
        const canvas = fabricRef.current;
        const pa = templateDef?.[activeSurface]?.printArea;
        if (!canvas || !pa) return;

        const vpt = canvas.viewportTransform?.slice() || [1, 0, 0, 1, 0, 0];
        const zoom = Number(vpt[0]) || 1;

        const prevBaseTx = -basePrintAreaRef.current.x * zoom;
        const prevBaseTy = -basePrintAreaRef.current.y * zoom;
        const panX = vpt[4] - prevBaseTx;
        const panY = vpt[5] - prevBaseTy;

        vpt[4] = -(pa.x || 0) * zoom + panX;
        vpt[5] = -(pa.y || 0) * zoom + panY;
        canvas.setViewportTransform(vpt);

        basePrintAreaRef.current = { x: pa.x || 0, y: pa.y || 0 };
    }, [activeSurface, templateDef]);

    const queueAlign = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            alignCanvasToPrintArea();
        });
    }, [alignCanvasToPrintArea]);

    const applyShirtColor = useCallback(() => {
        const svgEl = svgRef.current;
        if (!svgEl) return;
        const colorLayer = svgEl.querySelector('#color_first');
        if (colorLayer) colorLayer.setAttribute('fill', shirtColor || '#FFFFFF');
    }, [shirtColor]);

    const loadSurfaceSvg = useCallback(async () => {
        const source = templateDef?.[activeSurface]?.svg;
        const currentSvgNode = svgRef.current;
        if (!source || !currentSvgNode) return;

        const loadId = ++loadIdRef.current;

        try {
            const res = await fetch(source);
            const text = await res.text();
            if (loadId !== loadIdRef.current) return;

            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'image/svg+xml');
            const nextSvg = doc.querySelector('svg');
            if (!nextSvg) return;

            nextSvg.classList.add('mockup-svg');
            currentSvgNode.replaceWith(nextSvg);
            svgRef.current = nextSvg;

            setSvgRevision((v) => v + 1);
            queueAlign();
        } catch (error) {
            console.error('Failed to load SVG surface', error);
        }
    }, [activeSurface, queueAlign, templateDef]);

    useEffect(() => {
        loadSurfaceSvg();
    }, [loadSurfaceSvg]);

    useEffect(() => {
        applyShirtColor();
    }, [applyShirtColor, svgRevision]);

    /* ── mount Fabric canvas ─────────────────────────────────── */
    useEffect(() => {
        const el = canvasElRef.current;
        if (!el) return;

        const canvas = new Canvas(el, {
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundColor: 'rgba(0,0,0,0)',
            selection: true,
        });
        fabricRef.current = canvas;

        syncViewportToPrintArea();

        const onSelected = () => {
            const active = canvas.getActiveObject();
            if (active?._layerId) setSelectedLayerId(active._layerId);
            setSelectedObject(active ?? null);
        };
        const onCleared = () => { setSelectedLayerId(null); setSelectedObject(null); };
        const onModified = () => {
            syncLayersRef.current?.();
            pushHistoryRef.current?.();
        };
        const onTextChanged = () => { const a = canvas.getActiveObject(); setSelectedObject(a ?? null); };
        const onTextEditingExited = () => {
            syncLayersRef.current?.();
            pushHistoryRef.current?.();
        };

        canvas.on('selection:created', onSelected);
        canvas.on('selection:updated', onSelected);
        canvas.on('selection:cleared', onCleared);
        canvas.on('object:modified', onModified);
        canvas.on('text:changed', onTextChanged);
        canvas.on('text:editing:exited', onTextEditingExited);

        setCanvas(canvas);
        pushHistoryRef.current?.();
        queueAlign();

        return () => {
            canvas.off('selection:created', onSelected);
            canvas.off('selection:updated', onSelected);
            canvas.off('selection:cleared', onCleared);
            canvas.off('object:modified', onModified);
            canvas.off('text:changed', onTextChanged);
            canvas.off('text:editing:exited', onTextEditingExited);
            canvas.dispose();
            fabricRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        syncViewportToPrintArea();
    }, [syncViewportToPrintArea]);

    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        canvas.backgroundColor = 'rgba(0,0,0,0)';
        canvas.requestRenderAll();
    }, [activeSurface]);

    /* ── print-area measurement + observer ───────────────────── */
    useEffect(() => {
        queueAlign();
    }, [activeSurface, svgRevision, queueAlign]);

    useEffect(() => {
        const sceneEl = sceneRef.current;
        const svgEl = svgRef.current;
        if (!sceneEl || !svgEl) return;

        const observer = new ResizeObserver(() => {
            queueAlign();
        });

        observer.observe(sceneEl);
        observer.observe(svgEl);

        const placeholder = svgEl.querySelector(`#placeholder_${activeSurface}`);
        if (placeholder) observer.observe(placeholder);

        return () => observer.disconnect();
    }, [activeSurface, svgRevision, queueAlign]);

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

    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <div className={`editor${isPreviewMode ? ' preview' : ''}`} id="canvas-workspace">
            <div className="toolbar">
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

            <Positioner>
                <div ref={sceneRef} className="scene">
                    <svg ref={svgRef} className="mockup-svg" aria-label="T-shirt template" />
                    <canvas ref={canvasElRef} />
                </div>
            </Positioner>
        </div>
    );
}
