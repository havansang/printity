import {
    createContext, useContext, useCallback, useRef, useState, useEffect,
} from 'react';
import { IText, FabricImage, Circle, Rect, Triangle, Polygon } from 'fabric';
import { templates } from '../../templates/templates';

const SURFACES = ['front', 'back'];
const CUSTOM_PROPS = ['_layerId', '_imageName', '_shapeType', '_layerType'];
const MAX_HISTORY = 50;
const AUTO_SAVE_DELAY = 1000;

const TEMPLATE_KEY = 'tshirt';

const EditorContext = createContext(null);
let _nextId = 1;

/* ── Color palette from spec ──────────────────────────────── */
export const SHIRT_COLORS = [
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Silver', hex: '#C0C0C0' },
    { name: 'Iron Grey', hex: '#808080' },
    { name: 'Grey Concrete', hex: '#9E9E9E' },
    { name: 'Black', hex: '#1A1A1A' },
    { name: 'True Red', hex: '#CC0000' },
    { name: 'Cardinal', hex: '#8B0000' },
    { name: 'Maroon', hex: '#800000' },
    { name: 'Neon Orange', hex: '#FF6600' },
    { name: 'Gold', hex: '#FFD700' },
    { name: 'Neon Yellow', hex: '#FFFF00' },
    { name: 'Lime Shock', hex: '#AAFF00' },
    { name: 'Olive Drab Green', hex: '#6B8E23' },
    { name: 'Kelly Green', hex: '#4CBB17' },
    { name: 'Atomic Blue', hex: '#4F94CD' },
    { name: 'True Royal', hex: '#4169E1' },
    { name: 'True Navy', hex: '#1C2B5E' },
    { name: 'Purple', hex: '#6A0DAD' },
    { name: 'Neon Pink', hex: '#FF69B4' },
];

export function EditorProvider({ children }) {
    const canvasRef = useRef(null);
    const [layers, setLayers] = useState([]);
    const [selectedLayerId, setSelectedLayerId] = useState(null);
    const selectedObjectRef = useRef(null);

    /* ---------- multi-surface ---------------------------------------- */
    const [activeSurface, setActiveSurface] = useState('front');
    const activeSurfaceRef = useRef('front');
    const surfaceDataRef = useRef({ front: null, back: null });

    /* ---------- template --------------------------------------------- */
    const templateDef = templates[TEMPLATE_KEY];
    const [shirtColor, setShirtColor] = useState('#FFFFFF');

    /* ---------- history ---------------------------------------------- */
    const historyRef = useRef({
        front: { stack: [], pointer: -1 },
        back: { stack: [], pointer: -1 },
    });
    const _isRestoringHistory = useRef(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const autoSaveTimer = useRef(null);

    /* ---------- uploads gallery -------------------------------------- */
    const [uploadedImages, setUploadedImages] = useState([]);

    /* ---------- selected object type --------------------------------- */
    const [selectedObjectType, setSelectedObjectType] = useState(null);

    /* ---------- preview mode ---------------------------------------- */
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    /* ---------- canvas interaction mode ----------------------------- */
    const [isPanMode, setIsPanMode] = useState(false);
    const isPanRef = useRef(false);
    const isPanningRef = useRef(false);
    const lastPanPoint = useRef({ x: 0, y: 0 });

    /* ---------- zoom ------------------------------------------------- */
    const [zoomLevel, setZoomLevel] = useState(1);

    /* ---------- text style ------------------------------------------ */
    const DEFAULT_TEXT_STYLE = {
        fontSize: 28, fontFamily: 'Inter, sans-serif', fill: '#222222',
        fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', isText: false,
    };
    const [textStyle, setTextStyle] = useState(DEFAULT_TEXT_STYLE);

    useEffect(() => {
        activeSurfaceRef.current = activeSurface;
    }, [activeSurface]);

    /* ── helpers ─────────────────────────────────────────────────── */

    const _getPrintArea = useCallback(() => {
        const surface = activeSurface;
        return templateDef[surface]?.printArea ?? { x: 0, y: 0, width: 500, height: 600 };
    }, [activeSurface, templateDef]);

    const _refreshUndoRedo = useCallback(() => {
        const h = historyRef.current[activeSurface];
        setCanUndo(h.pointer > 0);
        setCanRedo(h.pointer < h.stack.length - 1);
    }, [activeSurface]);

    const syncLayers = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const objects = canvas.getObjects();
        const nextLayers = objects.map((obj) => {
            if (!obj._layerId) obj._layerId = _nextId++;
            let name = 'Object', type = 'shape';
            if (obj instanceof IText) { name = obj.text?.slice(0, 20) || 'Text'; type = 'text'; }
            else if (obj instanceof FabricImage) { name = obj._imageName || 'Image'; type = 'image'; }
            else if (obj._shapeType) { name = obj._shapeType; type = 'shape'; }
            return { id: obj._layerId, name, type };
        });
        setLayers(nextLayers);
    }, []);

    const _readTextStyle = useCallback((obj) => {
        if (!obj || !(obj instanceof IText)) {
            setTextStyle((s) => ({ ...s, isText: false }));
            return;
        }
        setTextStyle({
            fontSize: obj.fontSize ?? 28,
            fontFamily: obj.fontFamily ?? 'Inter, sans-serif',
            fill: obj.fill ?? '#222222',
            fontWeight: obj.fontWeight ?? 'normal',
            fontStyle: obj.fontStyle ?? 'normal',
            textAlign: obj.textAlign ?? 'left',
            isText: true,
        });
    }, []);

    const _detectObjectType = useCallback((obj) => {
        if (!obj) { setSelectedObjectType(null); return; }
        if (obj instanceof IText) { setSelectedObjectType('text'); return; }
        if (obj instanceof FabricImage) { setSelectedObjectType('image'); return; }
        setSelectedObjectType('shape');
    }, []);

    const setSelectedObject = useCallback((obj) => {
        selectedObjectRef.current = obj;
        _readTextStyle(obj);
        _detectObjectType(obj);
    }, [_readTextStyle, _detectObjectType]);

    const updateTextStyle = useCallback((prop, value) => {
        const canvas = canvasRef.current;
        const obj = selectedObjectRef.current;
        if (!canvas || !obj || !(obj instanceof IText)) return;
        obj.set(prop, value);
        canvas.requestRenderAll();
        setTextStyle((s) => ({ ...s, [prop]: value }));
        syncLayers();
    }, [syncLayers]);

    /* ── object constraints (stay in printArea) ─────────────────── */
    const _constrainObject = useCallback((obj) => {
        const canvas = canvasRef.current;
        let pa = _getPrintArea();
        if (canvas?.viewportTransform) {
            const vpt = canvas.viewportTransform;
            const zoom = Number(vpt[0]) || 1;
            if (zoom > 0) {
                pa = {
                    x: -vpt[4] / zoom,
                    y: -vpt[5] / zoom,
                    width: canvas.getWidth() / zoom,
                    height: canvas.getHeight() / zoom,
                };
            }
        }

        obj.setCoords();
        const bRect = obj.getBoundingRect();

        let dx = 0;
        let dy = 0;

        if (bRect.width >= pa.width) {
            dx = (pa.x + (pa.width - bRect.width) / 2) - bRect.left;
        } else if (bRect.left < pa.x) {
            dx = pa.x - bRect.left;
        } else if (bRect.left + bRect.width > pa.x + pa.width) {
            dx = (pa.x + pa.width) - (bRect.left + bRect.width);
        }

        if (bRect.height >= pa.height) {
            dy = (pa.y + (pa.height - bRect.height) / 2) - bRect.top;
        } else if (bRect.top < pa.y) {
            dy = pa.y - bRect.top;
        } else if (bRect.top + bRect.height > pa.y + pa.height) {
            dy = (pa.y + pa.height) - (bRect.top + bRect.height);
        }

        if (dx || dy) {
            obj.set({
                left: (obj.left ?? 0) + dx,
                top: (obj.top ?? 0) + dy,
            });
            obj.setCoords();
        }
    }, [_getPrintArea]);

    /* ── history ─────────────────────────────────────────────────── */

    const pushHistory = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || _isRestoringHistory.current) return;
        const json = canvas.toJSON(CUSTOM_PROPS);
        const h = historyRef.current[activeSurface];
        h.stack = h.stack.slice(0, h.pointer + 1);
        h.stack.push(json);
        if (h.stack.length > MAX_HISTORY) h.stack.shift();
        h.pointer = h.stack.length - 1;
        _refreshUndoRedo();
    }, [activeSurface, _refreshUndoRedo]);

    /* ── auto-save ───────────────────────────────────────────────── */
    const _triggerAutoSave = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        const surface = activeSurfaceRef.current;
        const snapshot = canvas.toJSON(CUSTOM_PROPS);
        autoSaveTimer.current = setTimeout(() => {
            surfaceDataRef.current[surface] = snapshot;
        }, AUTO_SAVE_DELAY);
    }, []);

    /* ── undo / redo ─────────────────────────────────────────────── */

    const undo = useCallback(async () => {
        const canvas = canvasRef.current;
        const h = historyRef.current[activeSurface];
        if (!canvas || h.pointer <= 0) return;
        _isRestoringHistory.current = true;
        h.pointer--;
        await canvas.loadFromJSON(h.stack[h.pointer]);
        canvas.requestRenderAll();
        _isRestoringHistory.current = false;
        syncLayers();
        _refreshUndoRedo();
    }, [activeSurface, syncLayers, _refreshUndoRedo]);

    const redo = useCallback(async () => {
        const canvas = canvasRef.current;
        const h = historyRef.current[activeSurface];
        if (!canvas || h.pointer >= h.stack.length - 1) return;
        _isRestoringHistory.current = true;
        h.pointer++;
        await canvas.loadFromJSON(h.stack[h.pointer]);
        canvas.requestRenderAll();
        _isRestoringHistory.current = false;
        syncLayers();
        _refreshUndoRedo();
    }, [activeSurface, syncLayers, _refreshUndoRedo]);

    /* ── canvas actions ──────────────────────────────────────────── */

    const setCanvas = useCallback((canvas) => {
        canvasRef.current = canvas;

        /* ── constraints on move/scale ── */
        canvas.on('object:moving', (e) => _constrainObject(e.target));
        canvas.on('object:scaling', (e) => _constrainObject(e.target));

        /* ── auto-save hooks ── */
        canvas.on('object:added', () => { if (!_isRestoringHistory.current) _triggerAutoSave(); });
        canvas.on('object:modified', () => { if (!_isRestoringHistory.current) _triggerAutoSave(); });
        canvas.on('object:removed', () => { if (!_isRestoringHistory.current) _triggerAutoSave(); });

        /* ── pan mode mouse hooks (attached once) ── */
        canvas.on('mouse:down', (opt) => {
            if (!isPanRef.current) return;
            isPanningRef.current = true;
            lastPanPoint.current = { x: opt.e.clientX, y: opt.e.clientY };
        });
        canvas.on('mouse:move', (opt) => {
            if (!isPanRef.current || !isPanningRef.current) return;
            const vpt = canvas.viewportTransform.slice();
            vpt[4] += opt.e.clientX - lastPanPoint.current.x;
            vpt[5] += opt.e.clientY - lastPanPoint.current.y;
            canvas.setViewportTransform(vpt);
            lastPanPoint.current = { x: opt.e.clientX, y: opt.e.clientY };
        });
        canvas.on('mouse:up', () => { isPanningRef.current = false; });

        syncLayers();
    }, [syncLayers, _constrainObject, _triggerAutoSave]);

    /* ── pan mode toggle ─────────────────────────────────────────── */
    const togglePanMode = useCallback((active) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const enable = active ?? !isPanRef.current;
        isPanRef.current = enable;
        setIsPanMode(enable);
        canvas.selection = !enable;
        canvas.defaultCursor = enable ? 'grab' : 'default';
        canvas.getObjects().forEach((o) => { o.selectable = !enable; o.evented = !enable; });
        canvas.requestRenderAll();
    }, []);

    /* ── zoom ────────────────────────────────────────────────────── */
    const applyZoom = useCallback((factor) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const newZoom = Math.min(3, Math.max(0.5, factor));
        canvas.setZoom(newZoom);
        setZoomLevel(newZoom);
    }, []);

    const zoomIn = useCallback(() => applyZoom(Math.min(3, Math.round((zoomLevel + 0.25) * 4) / 4)), [applyZoom, zoomLevel]);
    const zoomOut = useCallback(() => applyZoom(Math.max(0.5, Math.round((zoomLevel - 0.25) * 4) / 4)), [applyZoom, zoomLevel]);

    /* ── alignment (relative to printArea) ──────────────────────── */
    const alignObject = useCallback((alignment) => {
        const canvas = canvasRef.current;
        const obj = selectedObjectRef.current;
        if (!canvas || !obj) return;

        const pa = _getPrintArea();
        const bRect = obj.getBoundingRect();
        let newLeft = obj.left;
        let newTop = obj.top;

        switch (alignment) {
            case 'left': newLeft = pa.x; break;
            case 'right': newLeft = pa.x + pa.width - bRect.width; break;
            case 'top': newTop = pa.y; break;
            case 'bottom': newTop = pa.y + pa.height - bRect.height; break;
            case 'centerH': newLeft = pa.x + (pa.width - bRect.width) / 2; break;
            case 'centerV': newTop = pa.y + (pa.height - bRect.height) / 2; break;
            default: break;
        }
        obj.set({ left: newLeft, top: newTop });
        obj.setCoords();
        canvas.requestRenderAll();
        pushHistory();
    }, [_getPrintArea, pushHistory]);

    /* ── add objects ─────────────────────────────────────────────── */

    const addText = useCallback((fontFamily) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const pa = _getPrintArea();
        const text = new IText('Your text here', {
            left: pa.x + 20 + Math.random() * 60,
            top: pa.y + 20 + Math.random() * 60,
            fontSize: 32,
            fontFamily: fontFamily || 'Inter, sans-serif',
            fill: '#222222',
        });
        text._layerType = 'text';
        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.requestRenderAll();
        syncLayers();
        pushHistory();
    }, [syncLayers, pushHistory, _getPrintArea]);

    const addImage = useCallback((file) => {
        const canvas = canvasRef.current;
        if (!canvas || !file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target.result;
            setUploadedImages((prev) => [{ id: _nextId++, name: file.name.slice(0, 20), dataUrl }, ...prev]);
            _placeImageOnCanvas(dataUrl, file.name.slice(0, 20));
        };
        reader.readAsDataURL(file);
    }, []);

    const _placeImageOnCanvas = useCallback((dataUrl, name) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const pa = _getPrintArea();
        const imgEl = new Image();
        imgEl.onload = async () => {
            const fabricImg = new FabricImage(imgEl, { left: pa.x + 20, top: pa.y + 20 });
            fabricImg._imageName = name;
            fabricImg._layerType = 'image';
            const maxW = pa.width * 0.85;
            const maxH = pa.height * 0.85;
            if (fabricImg.width > maxW || fabricImg.height > maxH) {
                const scale = Math.min(maxW / fabricImg.width, maxH / fabricImg.height);
                fabricImg.scaleX = scale; fabricImg.scaleY = scale;
            }
            canvas.add(fabricImg);
            canvas.setActiveObject(fabricImg);
            canvas.requestRenderAll();
            syncLayers();
            pushHistory();
        };
        imgEl.src = dataUrl;
    }, [syncLayers, pushHistory, _getPrintArea]);

    const addImageFromDataUrl = useCallback((dataUrl, name) => {
        _placeImageOnCanvas(dataUrl, name);
    }, [_placeImageOnCanvas]);

    const addShape = useCallback((shapeType) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const pa = _getPrintArea();
        const baseOpts = {
            left: pa.x + 40 + Math.random() * 80,
            top: pa.y + 40 + Math.random() * 80,
            fill: '#4169E1', stroke: null, strokeWidth: 0,
        };
        let shape;
        switch (shapeType) {
            case 'Circle': shape = new Circle({ ...baseOpts, radius: 50 }); break;
            case 'Square': shape = new Rect({ ...baseOpts, width: 100, height: 100, rx: 6, ry: 6 }); break;
            case 'Triangle': shape = new Triangle({ ...baseOpts, width: 100, height: 90 }); break;
            case 'Star': {
                const pts = [];
                for (let i = 0; i < 10; i++) {
                    const r = i % 2 === 0 ? 50 : 22;
                    const a = (Math.PI / 5) * i - Math.PI / 2;
                    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
                }
                shape = new Polygon(pts, { ...baseOpts }); break;
            }
            case 'Heart': {
                const pts = [];
                for (let t = 0; t <= 360; t += 6) {
                    const r = (t * Math.PI) / 180;
                    pts.push({ x: 16 * Math.pow(Math.sin(r), 3), y: -(13 * Math.cos(r) - 5 * Math.cos(2 * r) - 2 * Math.cos(3 * r) - Math.cos(4 * r)) });
                }
                shape = new Polygon(pts, { ...baseOpts, scaleX: 3, scaleY: 3 }); break;
            }
            case 'Underline': shape = new Rect({ ...baseOpts, width: 160, height: 8, rx: 4, ry: 4 }); break;
            default: shape = new Rect({ ...baseOpts, width: 100, height: 100 });
        }
        shape._shapeType = shapeType;
        shape._layerType = 'shape';
        canvas.add(shape);
        canvas.setActiveObject(shape);
        canvas.requestRenderAll();
        syncLayers();
        pushHistory();
    }, [syncLayers, pushHistory, _getPrintArea]);

    /* ── delete / duplicate ──────────────────────────────────────── */

    const deleteSelected = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        canvas.remove(active);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        syncLayers();
        pushHistory();
        setSelectedLayerId(null);
        setSelectedObjectType(null);
        selectedObjectRef.current = null;
    }, [syncLayers, pushHistory]);

    const duplicateSelected = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        const clone = await active.clone(CUSTOM_PROPS);
        clone.set({ left: active.left + 20, top: active.top + 20 });
        clone._layerId = _nextId++;
        if (active._shapeType) clone._shapeType = active._shapeType;
        if (active._imageName) clone._imageName = active._imageName;
        if (active._layerType) clone._layerType = active._layerType;
        canvas.add(clone);
        canvas.setActiveObject(clone);
        canvas.requestRenderAll();
        syncLayers();
        pushHistory();
    }, [syncLayers, pushHistory]);

    const updateObjectTransform = useCallback((id, opts) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const obj = canvas.getObjects().find((o) => o._layerId === id);
        if (!obj) return;
        if (opts.angle !== undefined) obj.set('angle', opts.angle);
        if (opts.left !== undefined) obj.set('left', opts.left);
        if (opts.top !== undefined) obj.set('top', opts.top);
        if (opts.scaleX !== undefined) obj.set('scaleX', opts.scaleX);
        if (opts.scaleY !== undefined) obj.set('scaleY', opts.scaleY);
        if (opts.width !== undefined) obj.set('width', opts.width);
        if (opts.height !== undefined) obj.set('height', opts.height);
        if (opts.opacity !== undefined) obj.set('opacity', opts.opacity);
        if (opts.fill !== undefined) obj.set('fill', opts.fill);
        obj.setCoords();
        canvas.requestRenderAll();
        syncLayers();
        pushHistory();
    }, [syncLayers, pushHistory]);

    /* ── layer ops ───────────────────────────────────────────────── */

    const selectLayer = useCallback((id) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setSelectedLayerId(id);
        const obj = canvas.getObjects().find((o) => o._layerId === id);
        if (obj) { canvas.setActiveObject(obj); canvas.requestRenderAll(); }
    }, []);

    const deleteLayer = useCallback((id) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const obj = canvas.getObjects().find((o) => o._layerId === id);
        if (obj) {
            canvas.remove(obj);
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            syncLayers();
            pushHistory();
            setSelectedLayerId(null);
        }
    }, [syncLayers, pushHistory]);

    const reorderLayers = useCallback((fromVisualIndex, toVisualIndex) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const objects = canvas.getObjects();
        const total = objects.length;
        if (total < 2) return;
        const fromFabricIndex = total - 1 - fromVisualIndex;
        const toFabricIndex = total - 1 - toVisualIndex;
        const obj = objects[fromFabricIndex];
        if (!obj) return;
        canvas.moveObjectTo(obj, toFabricIndex);
        canvas.requestRenderAll();
        syncLayers();
        pushHistory();
    }, [syncLayers, pushHistory]);

    /* ── surface switching ───────────────────────────────────────── */

    const switchSurface = useCallback(async (target) => {
        const canvas = canvasRef.current;
        const fromSurface = activeSurfaceRef.current;
        if (!canvas || target === fromSurface) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

        _isRestoringHistory.current = true;
        surfaceDataRef.current[fromSurface] = canvas.toJSON(CUSTOM_PROPS);
        canvas.clear();
        const targetJson = surfaceDataRef.current[target];
        if (targetJson) await canvas.loadFromJSON(targetJson);
        canvas.backgroundColor = '#ffffff';
        canvas.requestRenderAll();
        _isRestoringHistory.current = false;

        activeSurfaceRef.current = target;
        setActiveSurface(target);
        setSelectedLayerId(null);
        setSelectedObjectType(null);
        selectedObjectRef.current = null;
        syncLayers();
        const th = historyRef.current[target];
        setCanUndo(th.pointer > 0);
        setCanRedo(th.pointer < th.stack.length - 1);
    }, [syncLayers]);

    /* ── value ───────────────────────────────────────────────────── */

    const value = {
        canvasRef,
        layers, selectedLayerId, setSelectedLayerId,
        setCanvas, syncLayers,
        addText, addImage, addImageFromDataUrl, addShape,
        selectLayer, deleteLayer, deleteSelected, duplicateSelected,
        updateObjectTransform, alignObject,
        activeSurface, surfaces: SURFACES, switchSurface,
        pushHistory, undo, redo, canUndo, canRedo,
        reorderLayers,
        textStyle, setSelectedObject, updateTextStyle,
        selectedObjectType,
        uploadedImages,
        shirtColor, setShirtColor,
        templateDef, activeSurface,
        isPreviewMode, setIsPreviewMode,
        isPanMode, togglePanMode,
        zoomLevel, zoomIn, zoomOut, applyZoom,
    };

    return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
    const ctx = useContext(EditorContext);
    if (!ctx) throw new Error('useEditor must be used within EditorProvider');
    return ctx;
}

export default EditorContext;
