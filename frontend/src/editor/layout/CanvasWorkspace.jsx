import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, Control, controlsUtils } from 'fabric';
import { useEditor } from './EditorContext';
import Positioner from './Positioner';

const CANVAS_W = 360;
const CANVAS_H = 560;
const CONTROL_GREEN = '#6abf57';
const CONTROL_BG = '#ffffff';

function renderRotateControl(ctx, left, top, _styleOverride, fabricObject) {
    const size = Math.max(26, Math.min(84, (fabricObject.cornerSize || 10) * 2.6));
    const radius = size / 2;

    ctx.save();
    ctx.translate(left, top);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = CONTROL_BG;
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = Math.max(2, radius * 0.5);
    ctx.shadowOffsetY = 1;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = Math.max(1, radius * 0.1);
    ctx.strokeStyle = '#dce4d8';
    ctx.stroke();

    ctx.fillStyle = CONTROL_GREEN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(radius * 1.55)}px sans-serif`;
    ctx.fillText('\u21bb', 0, 1);
    ctx.restore();
}

function createRotateControl(offsetY) {
    return new Control({
        x: 0,
        y: -0.5,
        offsetY,
        withConnection: false,
        actionName: 'rotate',
        actionHandler: controlsUtils.rotationWithSnapping,
        cursorStyleHandler: controlsUtils.rotationStyleHandler,
        render: renderRotateControl,
    });
}

function createEdgeScaleControl({ x, y, axis, size, touchSize }) {
    return new Control({
        x,
        y,
        withConnection: false,
        actionName: axis === 'x' ? 'scaleX' : 'scaleY',
        actionHandler: axis === 'x' ? controlsUtils.scalingX : controlsUtils.scalingY,
        cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
        sizeX: size,
        sizeY: size,
        touchSizeX: touchSize,
        touchSizeY: touchSize,
    });
}

export default function CanvasWorkspace() {
    const sceneRef = useRef(null);
    const svgRef = useRef(null);
    const canvasElRef = useRef(null);
    const fabricRef = useRef(null);
    const rafRef = useRef(null);
    const loadIdRef = useRef(0);
    const visualScaleRef = useRef(1);
    const basePrintAreaRef = useRef({ x: 0, y: 0 });
    const pushHistoryRef = useRef(null);
    const syncLayersRef = useRef(null);

    const {
        setCanvas, syncLayers, setSelectedLayerId,
        activeSurface, surfaces, switchSurface,
        pushHistory, undo, redo,
        setSelectedObject,
        templateDef,
        printArea,
        setSurfacePrintArea,
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

    const extractPrintAreaFromSvg = useCallback((svgEl, surface) => {
        if (!svgEl || !surface) return null;

        const placeholder = svgEl.querySelector(`#placeholder_${surface}`);
        if (!placeholder) return null;

        const width = Number.parseFloat(placeholder.getAttribute('width') || '')
            || placeholder.viewBox?.baseVal?.width
            || 0;
        const height = Number.parseFloat(placeholder.getAttribute('height') || '')
            || placeholder.viewBox?.baseVal?.height
            || 0;

        let x = Number.parseFloat(placeholder.getAttribute('x') || '') || 0;
        let y = Number.parseFloat(placeholder.getAttribute('y') || '') || 0;

        const parent = placeholder.parentElement;
        const transform = parent?.getAttribute('transform') || '';
        const match = transform.match(/translate\(\s*([-\d.+eE]+)(?:[\s,]+([-\d.+eE]+))?\s*\)/);
        if (match) {
            x = Number.parseFloat(match[1]) || x;
            y = Number.parseFloat(match[2] || '0') || y;
        }

        if (width <= 0 || height <= 0) return null;
        return { x, y, width, height };
    }, []);

    const applyInteractiveHandleScale = useCallback((renderScale, targetObj = null) => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const safeScale = Number.isFinite(renderScale) && renderScale > 0 ? renderScale : 1;
        const inverseScale = 1 / safeScale;
        const baseCornerSize = Math.max(8, Math.min(72, 10 * inverseScale));
        const baseTouchCornerSize = Math.max(14, Math.min(96, 22 * inverseScale));
        const edgeSize = Math.max(7, Math.min(40, baseCornerSize * 0.55));
        const edgeTouchSize = Math.max(12, Math.min(72, baseTouchCornerSize * 0.65));
        const cornerSize = edgeSize;
        const touchCornerSize = edgeTouchSize;
        const padding = 0;
        const borderScaleFactor = Math.max(1, Math.min(10, 1.6 * inverseScale));
        const rotateOffset = -Math.max(12, Math.min(96, 22 * inverseScale));

        canvas.targetFindTolerance = Math.max(4, Math.min(48, 8 * inverseScale));

        const applyToObject = (obj) => {
            if (!obj) return;
            obj.set({
                cornerSize,
                touchCornerSize,
                padding,
                borderScaleFactor,
                borderColor: CONTROL_GREEN,
                cornerColor: CONTROL_BG,
                cornerStrokeColor: CONTROL_GREEN,
                cornerStyle: 'rect',
                transparentCorners: false,
                borderDashArray: null,
                hasControls: true,
                lockScalingX: false,
                lockScalingY: false,
                lockRotation: false,
            });
            obj.controls = obj.controls || {};
            obj.controls.mtr = createRotateControl(rotateOffset);
            obj.controls.ml = createEdgeScaleControl({
                x: -0.5, y: 0, axis: 'x', size: edgeSize, touchSize: edgeTouchSize,
            });
            obj.controls.mr = createEdgeScaleControl({
                x: 0.5, y: 0, axis: 'x', size: edgeSize, touchSize: edgeTouchSize,
            });
            obj.controls.mt = createEdgeScaleControl({
                x: 0, y: -0.5, axis: 'y', size: edgeSize, touchSize: edgeTouchSize,
            });
            obj.controls.mb = createEdgeScaleControl({
                x: 0, y: 0.5, axis: 'y', size: edgeSize, touchSize: edgeTouchSize,
            });
            obj.setControlsVisibility({
                tl: true,
                tr: true,
                bl: true,
                br: true,
                mtr: true,
                mt: true,
                mb: true,
                ml: true,
                mr: true,
            });
            obj.setCoords();
        };

        if (targetObj) {
            applyToObject(targetObj);
            canvas.requestRenderAll();
            return;
        }

        canvas.getObjects().forEach(applyToObject);
        applyToObject(canvas.getActiveObject());
        canvas.requestRenderAll();
    }, []);

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
        visualScaleRef.current = scale;
        applyInteractiveHandleScale(scale);
    }, [applyInteractiveHandleScale, measurePrintArea]);

    const syncViewportToPrintArea = useCallback(() => {
        const canvas = fabricRef.current;
        const pa = printArea;
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
    }, [printArea]);

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

            const pa = extractPrintAreaFromSvg(nextSvg, activeSurface);
            if (pa) setSurfacePrintArea(activeSurface, pa);

            setSvgRevision((v) => v + 1);
            queueAlign();
        } catch (error) {
            console.error('Failed to load SVG surface', error);
        }
    }, [activeSurface, extractPrintAreaFromSvg, queueAlign, setSurfacePrintArea, templateDef]);

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
            width: printArea?.width || CANVAS_W,
            height: printArea?.height || CANVAS_H,
            backgroundColor: 'rgba(0,0,0,0)',
            selection: true,
        });
        fabricRef.current = canvas;

        syncViewportToPrintArea();

        const onSelected = () => {
            const active = canvas.getActiveObject();
            applyInteractiveHandleScale(visualScaleRef.current, active ?? null);
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
        const onObjectAdded = (e) => {
            applyInteractiveHandleScale(visualScaleRef.current, e?.target);
        };
        canvas.on('object:added', onObjectAdded);

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
            canvas.off('object:added', onObjectAdded);
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
        if (!canvas || !printArea) return;

        const nextW = Number(printArea.width) || CANVAS_W;
        const nextH = Number(printArea.height) || CANVAS_H;
        if (canvas.getWidth() !== nextW || canvas.getHeight() !== nextH) {
            canvas.setDimensions({ width: nextW, height: nextH });
        }

        syncViewportToPrintArea();
        queueAlign();
    }, [printArea, queueAlign, syncViewportToPrintArea]);

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
