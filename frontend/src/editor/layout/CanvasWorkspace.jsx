import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, Control, IText, Point, controlsUtils } from 'fabric';
import { useEditor } from './EditorContext';
import Positioner from './Positioner';

const CANVAS_W = 360;
const CANVAS_H = 560;
const CONTROL_GREEN = '#6abf57';
const CONTROL_BG = '#ffffff';
const SNAP_GUIDE_TOLERANCE_PX = 6;
const SVG_TEXT_CACHE = new Map();
const SVG_TEXT_REQUEST_CACHE = new Map();
const TEXTAREA_PATCH_FLAG = '__editorViewportTextareaPatch';

function getViewportTextareaPosition(textObj) {
    const canvas = textObj?.canvas;
    const upperCanvas = canvas?.upperCanvasEl;

    if (!canvas || !upperCanvas) {
        return {
            left: '1px',
            top: '1px',
            fontSize: '1px',
            charHeight: 1,
        };
    }

    const desiredPosition = textObj.inCompositionMode
        ? textObj.compositionStart
        : textObj.selectionStart;
    const boundaries = textObj._getCursorBoundaries(desiredPosition);
    const cursorLocation = textObj.get2DCursorLocation(desiredPosition);
    const lineIndex = cursorLocation.lineIndex;
    const charIndex = cursorLocation.charIndex;
    const rawFontSize = Number(textObj.getValueOfPropertyAt(lineIndex, charIndex, 'fontSize'))
        || Number(textObj.fontSize)
        || 16;
    const lineHeight = Number(textObj.lineHeight) || 1;
    const charHeight = Math.max(1, rawFontSize * lineHeight);
    const retinaScaling = textObj.getCanvasRetinaScaling?.() || 1;
    const upperCanvasWidth = upperCanvas.width / retinaScaling || upperCanvas.clientWidth || 1;
    const upperCanvasHeight = upperCanvas.height / retinaScaling || upperCanvas.clientHeight || 1;
    const canvasClientWidth = upperCanvas.clientWidth || upperCanvasWidth;
    const canvasClientHeight = upperCanvas.clientHeight || upperCanvasHeight;
    const displayRect = upperCanvas.getBoundingClientRect();
    const displayWidth = displayRect.width || canvasClientWidth || upperCanvasWidth;
    const displayHeight = displayRect.height || canvasClientHeight || upperCanvasHeight;
    const renderScaleX = displayWidth / upperCanvasWidth || 1;
    const renderScaleY = displayHeight / upperCanvasHeight || 1;
    const maxWidth = Math.max(0, upperCanvasWidth - charHeight);
    const maxHeight = Math.max(0, upperCanvasHeight - charHeight);

    const point = new Point(
        boundaries.left + boundaries.leftOffset,
        boundaries.top + boundaries.topOffset + charHeight,
    )
        .transform(textObj.calcTransformMatrix())
        .transform(canvas.viewportTransform)
        .multiply(new Point(
            canvasClientWidth / upperCanvasWidth,
            canvasClientHeight / upperCanvasHeight,
        ));

    const clampedCanvasX = Math.min(Math.max(point.x, 0), maxWidth);
    const clampedCanvasY = Math.min(Math.max(point.y, 0), maxHeight);
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
    const viewportWidth = viewport?.width || window.innerWidth || displayWidth || 1;
    const viewportHeight = viewport?.height || window.innerHeight || displayHeight || 1;
    const viewportOffsetLeft = viewport?.offsetLeft || 0;
    const viewportOffsetTop = viewport?.offsetTop || 0;
    const nextLeft = Math.min(
        Math.max(displayRect.left + viewportOffsetLeft + clampedCanvasX * renderScaleX, viewportOffsetLeft + 1),
        viewportOffsetLeft + viewportWidth - 2,
    );
    const nextTop = Math.min(
        Math.max(displayRect.top + viewportOffsetTop + clampedCanvasY * renderScaleY, viewportOffsetTop + 1),
        viewportOffsetTop + viewportHeight - 2,
    );
    const nextFontSize = Math.max(1, rawFontSize * renderScaleY);

    return {
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        fontSize: `${nextFontSize}px`,
        charHeight: nextFontSize,
    };
}

function applyViewportTextareaStyles(textObj) {
    const textarea = textObj?.hiddenTextarea;
    if (!textarea) return;

    const style = getViewportTextareaPosition(textObj);

    textarea.style.position = 'fixed';
    textarea.style.left = style.left;
    textarea.style.top = style.top;
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.margin = '0';
    textarea.style.paddingTop = style.fontSize;
    textarea.style.border = '0';
    textarea.style.opacity = '0';
    textarea.style.zIndex = '-999';
    textarea.style.transform = 'none';
}

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

function getSurfacePlaceholderSelector(surfaceDef, surfaceKey) {
    const placeholderId = surfaceDef?.placeholderId || `placeholder_${surfaceKey}`;
    return `#${placeholderId}`;
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
    const centerGuideLayerRef = useRef(null);
    const centerGuideVerticalRef = useRef(null);
    const centerGuideHorizontalRef = useRef(null);
    const centerGuideAreaRef = useRef(null);
    const centerGuideStateRef = useRef({ showVertical: false, showHorizontal: false });
    const pushHistoryRef = useRef(null);
    const syncLayersRef = useRef(null);

    const {
        setCanvas, syncLayers, setSelectedLayerId,
        activeSurface, surfaceDefs, switchSurface,
        pushHistory, undo, redo,
        setSelectedObject,
        printArea,
        setSurfacePrintArea,
        restoreCurrentSurface,
        shirtColor,
        isPreviewMode,
        zoomLevel,
        templateDef,
    } = useEditor();

    const [svgRevision, setSvgRevision] = useState(0);
    const activeSurfaceDef = useMemo(
        () => surfaceDefs.find((surface) => surface.key === activeSurface) || null,
        [activeSurface, surfaceDefs]
    );

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

        const placeholder = svgEl.querySelector(getSurfacePlaceholderSelector(activeSurfaceDef, activeSurface));
        if (!placeholder) return null;

        const sceneRect = sceneEl.getBoundingClientRect();
        const printRect = placeholder.getBoundingClientRect();

        if (printRect.width <= 0 || printRect.height <= 0) return null;

        // `Positioner` scales the whole scene, so convert back to scene-local units.
        const sceneZoom = Math.max(0.0001, Number(zoomLevel) || 1);

        return {
            left: (printRect.left - sceneRect.left) / sceneZoom,
            top: (printRect.top - sceneRect.top) / sceneZoom,
            width: printRect.width / sceneZoom,
            height: printRect.height / sceneZoom,
        };
    }, [activeSurface, activeSurfaceDef, zoomLevel]);

    const extractPrintAreaFromSvg = useCallback((svgEl, surfaceDef, surfaceKey) => {
        if (!svgEl || !surfaceKey) return null;

        const placeholder = svgEl.querySelector(getSurfacePlaceholderSelector(surfaceDef, surfaceKey));
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

    const updateCenterGuideArea = useCallback((area) => {
        const normalizedArea = area ? {
            left: Number(area.left) || 0,
            top: Number(area.top) || 0,
            width: Number(area.width) || 0,
            height: Number(area.height) || 0,
        } : null;

        centerGuideAreaRef.current = normalizedArea;
        const verticalGuideEl = centerGuideVerticalRef.current;
        const horizontalGuideEl = centerGuideHorizontalRef.current;

        if (!normalizedArea || !verticalGuideEl || !horizontalGuideEl) {
            return;
        }

        verticalGuideEl.style.left = `${normalizedArea.left + (normalizedArea.width / 2)}px`;
        verticalGuideEl.style.top = `${normalizedArea.top}px`;
        verticalGuideEl.style.height = `${normalizedArea.height}px`;

        horizontalGuideEl.style.left = `${normalizedArea.left}px`;
        horizontalGuideEl.style.top = `${normalizedArea.top + (normalizedArea.height / 2)}px`;
        horizontalGuideEl.style.width = `${normalizedArea.width}px`;
    }, []);

    const setCenterGuidesVisible = useCallback((nextState) => {
        const nextShowVertical = Boolean(nextState?.showVertical);
        const nextShowHorizontal = Boolean(nextState?.showHorizontal);
        const currentState = centerGuideStateRef.current;

        if (
            currentState.showVertical === nextShowVertical
            && currentState.showHorizontal === nextShowHorizontal
        ) {
            return;
        }

        centerGuideStateRef.current = {
            showVertical: nextShowVertical,
            showHorizontal: nextShowHorizontal,
        };

        const verticalGuideEl = centerGuideVerticalRef.current;
        const horizontalGuideEl = centerGuideHorizontalRef.current;

        if (verticalGuideEl) {
            verticalGuideEl.style.display = nextShowVertical ? 'block' : 'none';
        }

        if (horizontalGuideEl) {
            horizontalGuideEl.style.display = nextShowHorizontal ? 'block' : 'none';
        }
    }, []);

    const hideCenterGuides = useCallback(() => {
        setCenterGuidesVisible({ showVertical: false, showHorizontal: false });
    }, [setCenterGuidesVisible]);

    const updateCenterGuidesForObject = useCallback((obj) => {
        const pa = printArea;
        const guideArea = centerGuideAreaRef.current;

        if (!obj || !pa || !guideArea) {
            hideCenterGuides();
            return;
        }

        const printAreaCenterX = (Number(pa.x) || 0) + ((Number(pa.width) || 0) / 2);
        const printAreaCenterY = (Number(pa.y) || 0) + ((Number(pa.height) || 0) / 2);
        const centerPoint = obj.getCenterPoint?.();
        if (!centerPoint) {
            hideCenterGuides();
            return;
        }

        const tolerance = SNAP_GUIDE_TOLERANCE_PX / Math.max(visualScaleRef.current || 1, 0.0001);
        const shouldSnapX = Math.abs((Number(centerPoint.x) || 0) - printAreaCenterX) <= tolerance;
        const shouldSnapY = Math.abs((Number(centerPoint.y) || 0) - printAreaCenterY) <= tolerance;

        if (shouldSnapX || shouldSnapY) {
            obj.setPositionByOrigin(
                new Point(
                    shouldSnapX ? printAreaCenterX : centerPoint.x,
                    shouldSnapY ? printAreaCenterY : centerPoint.y,
                ),
                'center',
                'center',
            );
            obj.setCoords();
        }

        setCenterGuidesVisible({
            showVertical: shouldSnapX,
            showHorizontal: shouldSnapY,
        });
    }, [hideCenterGuides, printArea, setCenterGuidesVisible]);

    const alignCanvasToPrintArea = useCallback(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const pa = measurePrintArea();
        if (!pa) {
            updateCenterGuideArea(null);
            return;
        }

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
        updateCenterGuideArea(pa);
        applyInteractiveHandleScale(scale);
    }, [applyInteractiveHandleScale, measurePrintArea, updateCenterGuideArea]);

    const syncViewportToPrintArea = useCallback(() => {
        const canvas = fabricRef.current;
        const pa = printArea;
        if (!canvas || !pa) return;

        const vpt = canvas.viewportTransform?.slice() || [1, 0, 0, 1, 0, 0];
        const zoom = Number(vpt[0]) || 1;
        vpt[4] = -(pa.x || 0) * zoom;
        vpt[5] = -(pa.y || 0) * zoom;
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

    const getTextEditingContainer = useCallback(() => {
        if (typeof document === 'undefined') {
            return null;
        }

        return document.body || null;
    }, []);

    const assignTextEditingContainer = useCallback((targetObj = null) => {
        const container = getTextEditingContainer();
        const canvas = fabricRef.current;
        if (!container || !canvas) return;

        const assignToObject = (obj) => {
            if (!(obj instanceof IText)) return;
            obj.hiddenTextareaContainer = container;

            if (obj[TEXTAREA_PATCH_FLAG]) {
                applyViewportTextareaStyles(obj);
                return;
            }

            const originalInitHiddenTextarea = obj.initHiddenTextarea?.bind(obj);
            const originalUpdateTextareaPosition = obj.updateTextareaPosition?.bind(obj);

            obj._calcTextareaPosition = function patchedCalcTextareaPosition() {
                return getViewportTextareaPosition(this);
            };

            obj.initHiddenTextarea = function patchedInitHiddenTextarea(...args) {
                if (typeof originalInitHiddenTextarea === 'function') {
                    originalInitHiddenTextarea(...args);
                }
                applyViewportTextareaStyles(this);
            };

            obj.updateTextareaPosition = function patchedUpdateTextareaPosition(...args) {
                if (typeof originalUpdateTextareaPosition === 'function') {
                    originalUpdateTextareaPosition(...args);
                }
                applyViewportTextareaStyles(this);
            };

            obj[TEXTAREA_PATCH_FLAG] = true;
        };

        if (targetObj) {
            assignToObject(targetObj);
            return;
        }

        canvas.getObjects().forEach(assignToObject);
        assignToObject(canvas.getActiveObject());
    }, [getTextEditingContainer]);

    const fetchSvgText = useCallback(async (source) => {
        const normalizedSource = String(source || '').trim();
        if (!normalizedSource) {
            throw new Error('SVG source is required');
        }

        if (SVG_TEXT_CACHE.has(normalizedSource)) {
            return SVG_TEXT_CACHE.get(normalizedSource);
        }

        if (SVG_TEXT_REQUEST_CACHE.has(normalizedSource)) {
            return SVG_TEXT_REQUEST_CACHE.get(normalizedSource);
        }

        const request = fetch(normalizedSource)
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load SVG surface: ${activeSurface}`);
                }

                const text = await response.text();
                SVG_TEXT_CACHE.set(normalizedSource, text);
                return text;
            })
            .finally(() => {
                SVG_TEXT_REQUEST_CACHE.delete(normalizedSource);
            });

        SVG_TEXT_REQUEST_CACHE.set(normalizedSource, request);
        return request;
    }, [activeSurface]);

    const loadSurfaceSvg = useCallback(async () => {
        const source = activeSurfaceDef?.svg;
        const currentSvgNode = svgRef.current;
        if (!source || !currentSvgNode) return;

        const loadId = ++loadIdRef.current;

        try {
            const text = await fetchSvgText(source);
            if (loadId !== loadIdRef.current) return;

            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'image/svg+xml');
            const nextSvg = doc.querySelector('svg');
            if (!nextSvg) return;

            nextSvg.classList.add('mockup-svg');
            currentSvgNode.replaceWith(nextSvg);
            svgRef.current = nextSvg;

            const pa = extractPrintAreaFromSvg(nextSvg, activeSurfaceDef, activeSurface);
            if (pa) setSurfacePrintArea(activeSurface, pa);

            setSvgRevision((v) => v + 1);
            queueAlign();
        } catch (error) {
            console.error('Failed to load SVG surface', error);
        }
    }, [activeSurface, activeSurfaceDef, extractPrintAreaFromSvg, fetchSvgText, queueAlign, setSurfacePrintArea]);

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
            assignTextEditingContainer(active ?? null);
            applyInteractiveHandleScale(visualScaleRef.current, active ?? null);
            if (active?._layerId) setSelectedLayerId(active._layerId);
            setSelectedObject(active ?? null);
            hideCenterGuides();
        };
        const onCleared = () => {
            setSelectedLayerId(null);
            setSelectedObject(null);
            hideCenterGuides();
        };
        const onModified = () => {
            syncLayersRef.current?.();
            pushHistoryRef.current?.();
            hideCenterGuides();
        };
        const onTextEditingExited = () => {
            syncLayersRef.current?.();
            pushHistoryRef.current?.();
        };
        const onMouseDown = (event) => {
            assignTextEditingContainer(event?.target ?? null);
        };
        const onMouseUp = () => {
            hideCenterGuides();
        };
        const onTextEditingEntered = (event) => {
            assignTextEditingContainer(event?.target ?? null);
        };
        const onObjectMoving = (event) => {
            updateCenterGuidesForObject(event?.target ?? null);
        };

        canvas.on('selection:created', onSelected);
        canvas.on('selection:updated', onSelected);
        canvas.on('selection:cleared', onCleared);
        canvas.on('mouse:down', onMouseDown);
        canvas.on('mouse:up', onMouseUp);
        canvas.on('object:moving', onObjectMoving);
        canvas.on('object:modified', onModified);
        canvas.on('text:editing:entered', onTextEditingEntered);
        canvas.on('text:editing:exited', onTextEditingExited);
        const onObjectAdded = (e) => {
            assignTextEditingContainer(e?.target ?? null);
            applyInteractiveHandleScale(visualScaleRef.current, e?.target);
        };
        canvas.on('object:added', onObjectAdded);

        setCanvas(canvas);
        restoreCurrentSurface(canvas).then((restored) => {
            assignTextEditingContainer();
            if (!restored) pushHistoryRef.current?.();
            queueAlign();
        });

        return () => {
            canvas.off('selection:created', onSelected);
            canvas.off('selection:updated', onSelected);
            canvas.off('selection:cleared', onCleared);
            canvas.off('mouse:down', onMouseDown);
            canvas.off('mouse:up', onMouseUp);
            canvas.off('object:moving', onObjectMoving);
            canvas.off('object:modified', onModified);
            canvas.off('text:editing:entered', onTextEditingEntered);
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
        if (!isPreviewMode) {
            queueAlign();
        } else {
            hideCenterGuides();
        }
    }, [hideCenterGuides, isPreviewMode, queueAlign]);

    useEffect(() => {
        const guideLayerEl = centerGuideLayerRef.current;
        if (!guideLayerEl) return;
        guideLayerEl.style.display = isPreviewMode ? 'none' : 'block';
    }, [isPreviewMode]);

    useEffect(() => {
        const sceneEl = sceneRef.current;
        const svgEl = svgRef.current;
        if (!sceneEl || !svgEl) return;

        const observer = new ResizeObserver(() => {
            queueAlign();
        });

        observer.observe(sceneEl);
        observer.observe(svgEl);

        const placeholder = svgEl.querySelector(getSurfacePlaceholderSelector(activeSurfaceDef, activeSurface));
        if (placeholder) observer.observe(placeholder);

        return () => observer.disconnect();
    }, [activeSurface, activeSurfaceDef, svgRevision, queueAlign]);

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
                    {surfaceDefs.map((surface) => (
                        <button
                            key={surface.key}
                            className={`surface-tab${surface.key === activeSurface ? ' active' : ''}`}
                            id={`surface-tab-${surface.key}`}
                            onClick={() => switchSurface(surface.key)}
                        >
                            {surface.label}
                        </button>
                    ))}
                </div>
            </div>

            <Positioner>
                <div ref={sceneRef} className="scene">
                    <svg
                        ref={svgRef}
                        className="mockup-svg"
                        aria-label={`${templateDef?.name || 'Product'} template`}
                    />
                    <div ref={centerGuideLayerRef} className="scene-center-guides" aria-hidden="true">
                        <span
                            ref={centerGuideVerticalRef}
                            className="scene-center-guide scene-center-guide-vertical"
                        />
                        <span
                            ref={centerGuideHorizontalRef}
                            className="scene-center-guide scene-center-guide-horizontal"
                        />
                    </div>
                    <canvas ref={canvasElRef} />
                </div>
            </Positioner>
        </div>
    );
}
