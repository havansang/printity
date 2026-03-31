import {
    createContext, useContext, useCallback, useRef, useState, useEffect, useMemo,
} from 'react';
import { IText, FabricImage, Path, Point } from 'fabric';
import { navigate } from '../../app/router';
import { useAuth } from '../../features/auth/AuthContext';
import { createProject, updateProject } from '../../features/home/homeApi';
import {
    deleteAsset as deleteAssetRequest,
    fetchAssets,
    uploadAsset as uploadAssetRequest,
} from '../../shared/api/assetsApi';
import { fetchProductColors } from '../../shared/api/colorsApi';
import { fetchBackendFonts } from '../../shared/api/fontsApi';
import { fetchShapes } from '../../shared/api/shapesApi';
import { resolveRenderableAssetUrl } from '../../shared/lib/assetUrls';
import { getTemplateSurfaces, templates } from '../../templates/templates';
import {
    DEFAULT_EDITOR_FONT_FAMILY,
    createFontLoadKey,
    findEditorFontByFamily,
    loadEditorFontFace,
    mergeEditorFonts,
    pickEditorFontVariant,
    normalizeFontFamily,
    normalizeFontStyle,
    normalizeFontWeight,
} from './editorFonts';

const CUSTOM_PROPS = [
    '_layerId',
    '_imageName',
    'imageName',
    '_coordinateOrigin',
    'coordinateOrigin',
    '_shapeType',
    '_layerType',
    'layerType',
    '_assetId',
    'assetId',
    '_assetUrl',
    'assetUrl',
    '_sourceMimeType',
    'sourceMimeType',
    '_shapeSlug',
    'shapeSlug',
    '_shapeId',
    'shapeId',
    '_shapePathCommands',
    'shapePathCommands',
    '_shapeSourceWidth',
    'shapeSourceWidth',
    '_shapeSourceHeight',
    'shapeSourceHeight',
];
const MAX_HISTORY = 50;
const AUTO_SAVE_DELAY = 1000;
const DEFAULT_PRINT_AREA = { x: 0, y: 0, width: 360, height: 560 };
const SCENE_ZOOM_MIN = 0.03;
const SCENE_ZOOM_MAX = 4;
const SCENE_ZOOM_STEP = 1.1;

const DEFAULT_TEMPLATE_KEY = 'tshirt';
const DEFAULT_TEMPLATE_DEF = templates[DEFAULT_TEMPLATE_KEY] || {};
const BACKEND_TEMPLATE_ID_PATTERN = /^[a-f\d]{24}$/i;
const DEFAULT_SHIRT_COLOR_HEX = '#FFFFFF';
const DEFAULT_SHAPE_COLOR_HEX = '#64634A';

const EditorContext = createContext(null);
let _nextId = 1;

function cloneSerializable(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
}

function createSurfaceMap(surfaceKeys, createValue) {
    return Object.fromEntries(surfaceKeys.map((surfaceKey) => [surfaceKey, createValue(surfaceKey)]));
}

function normalizePrintArea(area) {
    if (!area || typeof area !== 'object') {
        return cloneSerializable(DEFAULT_PRINT_AREA);
    }

    return {
        x: Number(area.x) || 0,
        y: Number(area.y) || 0,
        width: Number(area.width) || DEFAULT_PRINT_AREA.width,
        height: Number(area.height) || DEFAULT_PRINT_AREA.height,
    };
}

function normalizeOptionalPrintArea(area) {
    if (!area || typeof area !== 'object') {
        return null;
    }

    const width = Number(area.width);
    const height = Number(area.height);
    if (width <= 0 || height <= 0) {
        return null;
    }

    return {
        x: Number(area.x) || 0,
        y: Number(area.y) || 0,
        width,
        height,
    };
}

function snapshotHasObjects(snapshot) {
    return Array.isArray(snapshot?.objects) && snapshot.objects.length > 0;
}

function formatProjectTimestamp(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function buildProjectName(templateDef) {
    const baseName = String(templateDef?.name || templateDef?.productType || 'Product').trim() || 'Product';
    return `${baseName} ${formatProjectTimestamp()}`.slice(0, 100);
}

function getInitialProjectSurfaceSnapshots(initialProject, surfaceKeys) {
    return createSurfaceMap(
        surfaceKeys,
        (surfaceKey) => cloneSerializable(initialProject?.surfaces?.[surfaceKey]?.canvasJson || null)
    );
}

function getInitialProjectPrintAreas(initialProject, surfaceDefs) {
    const surfacePrintAreaByKey = Object.fromEntries(
        (surfaceDefs || []).map((surfaceDef) => [surfaceDef.key, surfaceDef?.printArea || null])
    );
    const surfaceKeys = (surfaceDefs || []).map((surfaceDef) => surfaceDef.key);

    return createSurfaceMap(surfaceKeys, (surfaceKey) => (
        normalizeOptionalPrintArea(surfacePrintAreaByKey[surfaceKey])
        || normalizeOptionalPrintArea(initialProject?.printPayloadRaw?.printAreas?.[surfaceKey])
        || cloneSerializable(DEFAULT_PRINT_AREA)
    ));
}

/* ── Color palette from spec ──────────────────────────────── */
const DEFAULT_SHIRT_COLORS = [
    {
        key: 'white',
        label: 'White',
        hex: DEFAULT_SHIRT_COLOR_HEX,
        rgb: 'rgb(255,255,255)',
        imageUrl: null,
        isLight: true,
    },
];

function normalizeShirtColorHex(hex) {
    const value = String(hex || '').trim().toUpperCase();
    if (!value) return null;
    return value.startsWith('#') ? value : `#${value}`;
}

function normalizeShirtColors(items) {
    if (!Array.isArray(items)) {
        return DEFAULT_SHIRT_COLORS;
    }

    const normalized = items
        .map((item, index) => {
            const label = String(item?.label || item?.name || '').trim();
            const hex = normalizeShirtColorHex(item?.hex);

            if (!label || !hex) {
                return null;
            }

            return {
                key: String(item?.key || label || index).trim(),
                label,
                hex,
                rgb: String(item?.rgb || '').trim() || null,
                imageUrl: String(item?.imageUrl || '').trim() || null,
                isLight: Boolean(item?.isLight),
            };
        })
        .filter(Boolean);

    return normalized.length > 0 ? normalized : DEFAULT_SHIRT_COLORS;
}

function normalizeUploadedImageEntry(item) {
    const id = String(item?.id || '').trim();
    const originalName = String(item?.originalName || item?.name || 'Image').trim() || 'Image';
    const url = String(item?.url || '').trim();

    if (!id || !url) {
        return null;
    }

    return {
        id,
        name: originalName.slice(0, 20),
        originalName,
        url,
        renderUrl: resolveRenderableAssetUrl(url),
        mimeType: String(item?.mimeType || '').trim() || null,
        width: Number(item?.width) || null,
        height: Number(item?.height) || null,
    };
}

function normalizeShapeEntry(item) {
    const id = String(item?.id || '').trim();
    const name = String(item?.name || '').trim();
    const slug = String(item?.slug || '').trim().toLowerCase();
    const pathCommands = String(item?.geometry?.pathCommands || '').trim();
    const defaultWidth = Number(item?.geometry?.defaultWidth);
    const defaultHeight = Number(item?.geometry?.defaultHeight);

    if (!id || !name || !slug || !pathCommands || defaultWidth <= 0 || defaultHeight <= 0) {
        return null;
    }

    return {
        id,
        name,
        slug,
        group: String(item?.group || 'basic').trim().toLowerCase() || 'basic',
        tags: Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : [],
        previewUrl: String(item?.previewUrl || '').trim() || null,
        geometry: {
            pathCommands,
            defaultWidth,
            defaultHeight,
        },
    };
}

export function EditorProvider({ children, templateDef: providedTemplateDef, initialProject = null }) {
    const { token } = useAuth();
    const canvasRef = useRef(null);
    const [layers, setLayers] = useState([]);
    const [selectedLayerId, setSelectedLayerId] = useState(null);
    const selectedObjectRef = useRef(null);

    /* ---------- template --------------------------------------------- */
    const templateDef = providedTemplateDef || DEFAULT_TEMPLATE_DEF;
    const surfaceDefs = useMemo(() => getTemplateSurfaces(templateDef), [templateDef]);
    const surfaceKeys = surfaceDefs.map((surface) => surface.key);
    const initialSurface = surfaceKeys.includes(initialProject?.printPayloadRaw?.activeSurface)
        ? initialProject.printPayloadRaw.activeSurface
        : (surfaceKeys[0] || 'front');
    const initialProjectId = String(initialProject?.id || '').trim();
    const initialProjectName = String(initialProject?.name || '').trim();
    const initialShirtColor = normalizeShirtColorHex(
        initialProject?.selection?.colorHex || initialProject?.printPayloadRaw?.shirtColor
    ) || DEFAULT_SHIRT_COLOR_HEX;
    const initialSurfaceSnapshots = getInitialProjectSurfaceSnapshots(initialProject, surfaceKeys);
    const initialSurfacePrintAreas = getInitialProjectPrintAreas(initialProject, surfaceDefs);

    /* ---------- multi-surface ---------------------------------------- */
    const [activeSurface, setActiveSurface] = useState(initialSurface);
    const activeSurfaceRef = useRef(initialSurface);
    const surfaceDataRef = useRef(initialSurfaceSnapshots);

    const [shirtColor, setShirtColor] = useState(initialShirtColor);
    const [shirtColors, setShirtColors] = useState(DEFAULT_SHIRT_COLORS);
    const [shirtColorsLoading, setShirtColorsLoading] = useState(true);
    const [shirtColorsError, setShirtColorsError] = useState('');
    const [surfacePrintAreas, setSurfacePrintAreas] = useState(initialSurfacePrintAreas);

    /* ---------- history ---------------------------------------------- */
    const historyRef = useRef(createSurfaceMap(surfaceKeys, () => ({ stack: [], pointer: -1 })));
    const _isRestoringHistory = useRef(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const autoSaveTimer = useRef(null);

    /* ---------- uploads gallery -------------------------------------- */
    const [uploadedImages, setUploadedImages] = useState([]);
    const [uploadedImagesLoading, setUploadedImagesLoading] = useState(false);
    const [uploadedImagesError, setUploadedImagesError] = useState('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [deletingAssetId, setDeletingAssetId] = useState('');

    /* ---------- backend font catalog --------------------------------- */
    const [availableFonts, setAvailableFonts] = useState(() => mergeEditorFonts());
    const availableFontsRef = useRef(availableFonts);
    const [fontsLoading, setFontsLoading] = useState(true);
    const [fontsError, setFontsError] = useState('');
    const loadedFontFacesRef = useRef(new Set());
    const pendingFontLoadsRef = useRef(new Map());

    /* ---------- backend shapes catalog ------------------------------- */
    const [availableShapes, setAvailableShapes] = useState([]);
    const [shapesLoading, setShapesLoading] = useState(false);
    const [shapesError, setShapesError] = useState('');
    const [shapesLoaded, setShapesLoaded] = useState(false);
    const hasLoadedShapesRef = useRef(false);
    const pendingShapesLoadRef = useRef(null);

    /* ---------- selected object type --------------------------------- */
    const [selectedObjectType, setSelectedObjectType] = useState(null);

    /* ---------- preview mode ---------------------------------------- */
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [hasDesignContent, setHasDesignContent] = useState(false);
    const [isSavingProduct, setIsSavingProduct] = useState(false);

    /* ---------- canvas interaction mode ----------------------------- */
    const [isPanMode, setIsPanMode] = useState(false);
    const isPanRef = useRef(false);

    /* ---------- zoom ------------------------------------------------- */
    const [zoomLevel, setZoomLevel] = useState(1);

    /* ---------- text style ------------------------------------------ */
    const DEFAULT_TEXT_STYLE = {
        fontSize: 28, fontFamily: DEFAULT_EDITOR_FONT_FAMILY, fill: '#222222',
        fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', isText: false,
    };
    const [textStyle, setTextStyle] = useState(DEFAULT_TEXT_STYLE);

    useEffect(() => {
        activeSurfaceRef.current = activeSurface;
    }, [activeSurface]);

    useEffect(() => {
        availableFontsRef.current = availableFonts;
    }, [availableFonts]);

    useEffect(() => {
        let isCancelled = false;
        const templateColorItems = Array.isArray(templateDef?.availableColors)
            ? templateDef.availableColors
            : [];

        setShirtColorsLoading(true);
        setShirtColorsError('');

        if (templateColorItems.length > 0) {
            const nextColors = normalizeShirtColors(templateColorItems);
            setShirtColors(nextColors);
            setShirtColor((currentValue) => (
                nextColors.some((color) => color.hex === currentValue)
                    ? currentValue
                    : (nextColors[0]?.hex || DEFAULT_SHIRT_COLOR_HEX)
            ));
            setShirtColorsLoading(false);
            return undefined;
        }

        fetchProductColors({ productType: templateDef?.productType })
            .then((payload) => {
                if (isCancelled) return;
                const nextColors = normalizeShirtColors(payload?.data?.items);
                setShirtColors(nextColors);
                setShirtColor((currentValue) => (
                    nextColors.some((color) => color.hex === currentValue)
                        ? currentValue
                        : (nextColors[0]?.hex || DEFAULT_SHIRT_COLOR_HEX)
                ));
            })
            .catch((error) => {
                if (isCancelled) return;
                setShirtColors(DEFAULT_SHIRT_COLORS);
                setShirtColorsError(error?.message || 'Unable to load product colors from the API.');
            })
            .finally(() => {
                if (!isCancelled) setShirtColorsLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [templateDef?.availableColors, templateDef?.productType]);

    useEffect(() => {
        let isCancelled = false;

        if (!token) {
            setUploadedImages([]);
            setUploadedImagesLoading(false);
            setUploadedImagesError('');
            return undefined;
        }

        setUploadedImagesLoading(true);
        setUploadedImagesError('');

        fetchAssets(token)
            .then((payload) => {
                if (isCancelled) return;
                const items = Array.isArray(payload?.data?.items)
                    ? payload.data.items.map(normalizeUploadedImageEntry).filter(Boolean)
                    : [];
                setUploadedImages(items);
            })
            .catch((error) => {
                if (isCancelled) return;
                setUploadedImages([]);
                setUploadedImagesError(error?.message || 'Unable to load uploaded assets.');
            })
            .finally(() => {
                if (!isCancelled) setUploadedImagesLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [token]);

    const refreshTextObjectLayout = useCallback((obj) => {
        if (!obj || !(obj instanceof IText)) return false;

        if (typeof obj.initDimensions === 'function') {
            obj.initDimensions();
        }

        obj.set({
            dirty: true,
        });
        obj.setCoords();
        return true;
    }, []);

    const refreshCanvasTextLayout = useCallback((canvas, { fontFamily } = {}) => {
        if (!canvas) return false;

        const targetFamily = fontFamily ? normalizeFontFamily(fontFamily) : '';
        let hasChanges = false;

        canvas.getObjects().forEach((obj) => {
            if (!(obj instanceof IText)) return;
            if (targetFamily && normalizeFontFamily(obj.fontFamily) !== targetFamily) return;

            hasChanges = refreshTextObjectLayout(obj) || hasChanges;
        });

        return hasChanges;
    }, [refreshTextObjectLayout]);

    const loadFontFamily = useCallback(async (fontFamily, options = {}) => {
        const normalizedFamily = normalizeFontFamily(fontFamily);
        const requestedWeight = normalizeFontWeight(options.fontWeight);
        const requestedStyle = normalizeFontStyle(options.fontStyle);
        const fontLoadKey = createFontLoadKey(normalizedFamily, requestedWeight, requestedStyle);

        if (loadedFontFacesRef.current.has(fontLoadKey)) {
            return normalizedFamily;
        }

        if (pendingFontLoadsRef.current.has(fontLoadKey)) {
            return pendingFontLoadsRef.current.get(fontLoadKey);
        }

        const fontEntry = findEditorFontByFamily(availableFontsRef.current, normalizedFamily) || {
            family: normalizedFamily,
            variants: [],
        };

        const loadPromise = loadEditorFontFace(fontEntry, {
            fontWeight: requestedWeight,
            fontStyle: requestedStyle,
        })
            .then((loadedFamily) => {
                loadedFontFacesRef.current.add(fontLoadKey);
                refreshCanvasTextLayout(canvasRef.current, { fontFamily: normalizedFamily });
                canvasRef.current?.requestRenderAll();
                return loadedFamily || normalizedFamily;
            })
            .catch((error) => {
                console.warn(`Failed to load font "${normalizedFamily}"`, error);
                return normalizedFamily;
            })
            .finally(() => {
                pendingFontLoadsRef.current.delete(fontLoadKey);
            });

        pendingFontLoadsRef.current.set(fontLoadKey, loadPromise);
        return loadPromise;
    }, [refreshCanvasTextLayout]);

    const ensureFontFamilyLoaded = useCallback((fontFamily, options = {}) => {
        const normalizedFamily = normalizeFontFamily(fontFamily);
        const requestedWeight = normalizeFontWeight(options.fontWeight);
        const requestedStyle = normalizeFontStyle(options.fontStyle);
        const fontLoadKey = createFontLoadKey(normalizedFamily, requestedWeight, requestedStyle);

        if (loadedFontFacesRef.current.has(fontLoadKey) || pendingFontLoadsRef.current.has(fontLoadKey)) {
            return null;
        }

        return loadFontFamily(normalizedFamily, {
            fontWeight: requestedWeight,
            fontStyle: requestedStyle,
        });
    }, [loadFontFamily]);

    useEffect(() => {
        let isCancelled = false;

        setFontsLoading(true);
        setFontsError('');

        fetchBackendFonts({ includeVariants: true })
            .then((payload) => {
                if (isCancelled) return;
                const nextFonts = mergeEditorFonts(
                    payload?.data?.items || [],
                    payload?.data?.fallbackFamilies || []
                );
                setAvailableFonts(nextFonts);
                void loadFontFamily(DEFAULT_EDITOR_FONT_FAMILY);
            })
            .catch((error) => {
                if (isCancelled) return;
                setAvailableFonts(mergeEditorFonts());
                setFontsError(error?.message || 'Unable to load fonts from the API.');
            })
            .finally(() => {
                if (!isCancelled) setFontsLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [loadFontFamily]);

    const loadAvailableShapes = useCallback(async ({ force = false } = {}) => {
        if (!force && hasLoadedShapesRef.current) {
            return availableShapes;
        }

        if (pendingShapesLoadRef.current) {
            return pendingShapesLoadRef.current;
        }

        setShapesLoading(true);
        setShapesError('');

        const request = fetchShapes({ activeOnly: true })
            .then((payload) => {
                const items = Array.isArray(payload?.data?.items)
                    ? payload.data.items.map(normalizeShapeEntry).filter(Boolean)
                    : [];
                hasLoadedShapesRef.current = true;
                setAvailableShapes(items);
                setShapesLoaded(true);
                return items;
            })
            .catch((error) => {
                hasLoadedShapesRef.current = false;
                setAvailableShapes([]);
                setShapesLoaded(false);
                setShapesError(error?.message || 'Unable to load graphics from the API.');
                return [];
            })
            .finally(() => {
                pendingShapesLoadRef.current = null;
                setShapesLoading(false);
            });

        pendingShapesLoadRef.current = request;
        return request;
    }, [availableShapes]);

    /* ── helpers ─────────────────────────────────────────────────── */

    const ensureCanvasTextFonts = useCallback((canvas) => {
        if (!canvas) return;

        let hasChanges = false;

        canvas.getObjects().forEach((obj) => {
            if (!(obj instanceof IText)) return;

            const normalizedFamily = normalizeFontFamily(obj.fontFamily);
            if (normalizedFamily !== obj.fontFamily) {
                obj.set('fontFamily', normalizedFamily);
                hasChanges = true;
            }

            void loadFontFamily(normalizedFamily, {
                fontWeight: obj.fontWeight,
                fontStyle: obj.fontStyle,
            });

            hasChanges = refreshTextObjectLayout(obj) || hasChanges;
        });

        if (hasChanges) {
            canvas.requestRenderAll();
        }
    }, [loadFontFamily, refreshTextObjectLayout]);

    const _getPrintArea = useCallback(() => {
        const surface = activeSurface;
        return surfacePrintAreas[surface] ?? DEFAULT_PRINT_AREA;
    }, [activeSurface, surfacePrintAreas]);

    const _getObjectUnitScale = useCallback(() => {
        const pa = _getPrintArea();
        const w = Number(pa?.width) || DEFAULT_PRINT_AREA.width;
        const h = Number(pa?.height) || DEFAULT_PRINT_AREA.height;
        const scaleW = w / DEFAULT_PRINT_AREA.width;
        const scaleH = h / DEFAULT_PRINT_AREA.height;
        return Math.min(8, Math.max(0.5, (scaleW + scaleH) / 2));
    }, [_getPrintArea]);

    const setSurfacePrintArea = useCallback((surface, area) => {
        if (!surface || !area) return;
        const nextArea = {
            x: Number(area.x) || 0,
            y: Number(area.y) || 0,
            width: Number(area.width) || DEFAULT_PRINT_AREA.width,
            height: Number(area.height) || DEFAULT_PRINT_AREA.height,
        };
        if (nextArea.width <= 0 || nextArea.height <= 0) return;

        setSurfacePrintAreas((prev) => {
            const current = prev[surface] || DEFAULT_PRINT_AREA;
            if (
                Math.abs(current.x - nextArea.x) < 0.001 &&
                Math.abs(current.y - nextArea.y) < 0.001 &&
                Math.abs(current.width - nextArea.width) < 0.001 &&
                Math.abs(current.height - nextArea.height) < 0.001
            ) return prev;

            return { ...prev, [surface]: nextArea };
        });
    }, []);

    const _refreshUndoRedo = useCallback(() => {
        const h = historyRef.current[activeSurface] || { stack: [], pointer: -1 };
        setCanUndo(h.pointer > 0);
        setCanRedo(h.pointer < h.stack.length - 1);
    }, [activeSurface]);

    const refreshHasDesignContent = useCallback(() => {
        const canvas = canvasRef.current;
        const currentSurface = activeSurfaceRef.current;
        const currentSurfaceHasObjects = Boolean(
            canvas
            && !canvas.disposed
            && !canvas.destroyed
            && canvas.getObjects().length > 0
        );
        const nextHasDesignContent = surfaceKeys.some((surfaceKey) => (
            surfaceKey === currentSurface
                ? currentSurfaceHasObjects
                : snapshotHasObjects(surfaceDataRef.current[surfaceKey])
        ));
        setHasDesignContent(nextHasDesignContent);
        return nextHasDesignContent;
    }, [surfaceKeys]);

    const syncLayers = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const objects = canvas.getObjects();
        const nextLayers = objects.map((obj) => {
            if (!obj._layerId) obj._layerId = _nextId++;
            const rawType = String(obj?.type || '').toLowerCase();
            let type = obj?._layerType || 'shape';
            if (obj instanceof IText || rawType === 'i-text' || rawType === 'textbox') type = 'text';
            else if (obj instanceof FabricImage || rawType === 'image') type = 'image';

            let name = 'Object';
            if (type === 'text') name = (obj?.text || '').toString().slice(0, 20) || 'Text';
            else if (type === 'image') name = obj?._imageName || 'Image';
            else if (obj?._shapeType) name = obj._shapeType;
            else if (rawType) name = rawType[0].toUpperCase() + rawType.slice(1);
            return { id: obj._layerId, name, type };
        });
        setLayers(nextLayers);
        refreshHasDesignContent();
    }, [refreshHasDesignContent]);

    const _readTextStyle = useCallback((obj) => {
        if (!obj || !(obj instanceof IText)) {
            setTextStyle((s) => ({ ...s, isText: false }));
            return;
        }
        const normalizedFamily = normalizeFontFamily(obj.fontFamily);
        void ensureFontFamilyLoaded(normalizedFamily, {
            fontWeight: obj.fontWeight,
            fontStyle: obj.fontStyle,
        });
        setTextStyle({
            fontSize: obj.fontSize ?? 28,
            fontFamily: normalizedFamily,
            fill: obj.fill ?? '#222222',
            fontWeight: obj.fontWeight ?? 'normal',
            fontStyle: obj.fontStyle ?? 'normal',
            textAlign: obj.textAlign ?? 'left',
            isText: true,
        });
    }, [ensureFontFamilyLoaded]);

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

    const updateTextStyle = useCallback(async (prop, value) => {
        const canvas = canvasRef.current;
        const obj = selectedObjectRef.current;
        if (!canvas || !obj || !(obj instanceof IText)) return;

        let nextValue = value;
        if (prop === 'fontFamily') {
            nextValue = normalizeFontFamily(value);
            await loadFontFamily(nextValue, {
                fontWeight: obj.fontWeight,
                fontStyle: obj.fontStyle,
            });
        }

        if (prop === 'fontWeight') {
            await loadFontFamily(obj.fontFamily, {
                fontWeight: value,
                fontStyle: obj.fontStyle,
            });
        }

        if (prop === 'fontStyle') {
            await loadFontFamily(obj.fontFamily, {
                fontWeight: obj.fontWeight,
                fontStyle: value,
            });
        }

        obj.set(prop, nextValue);
        refreshTextObjectLayout(obj);
        canvas.requestRenderAll();
        setTextStyle((s) => ({ ...s, [prop]: nextValue }));
        syncLayers();
    }, [loadFontFamily, refreshTextObjectLayout, syncLayers]);

    /* ── object constraints (stay in printArea) ─────────────────── */
    const _constrainObject = useCallback((obj) => {
        // Allow free movement outside print area (no hard clamp).
        if (obj) obj.setCoords();
    }, []);

    /* ── history ─────────────────────────────────────────────────── */

    const pushHistory = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || _isRestoringHistory.current) return;
        const json = canvas.toJSON(CUSTOM_PROPS);
        const h = historyRef.current[activeSurface] || { stack: [], pointer: -1 };
        historyRef.current[activeSurface] = h;
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
            setHasDesignContent(surfaceKeys.some((surfaceKey) => (
                surfaceKey === surface
                    ? snapshotHasObjects(snapshot)
                    : snapshotHasObjects(surfaceDataRef.current[surfaceKey])
            )));
        }, AUTO_SAVE_DELAY);
    }, [surfaceKeys]);

    const captureSurfaceSnapshots = useCallback(() => {
        const canvas = canvasRef.current;
        const surface = activeSurfaceRef.current;
        const canReadCanvas = Boolean(canvas && !canvas.disposed && !canvas.destroyed);

        if (autoSaveTimer.current) {
            clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = null;
        }

        if (canReadCanvas) {
            surfaceDataRef.current[surface] = canvas.toJSON(CUSTOM_PROPS);
        }

        const snapshots = createSurfaceMap(
            surfaceKeys,
            (surfaceKey) => cloneSerializable(surfaceDataRef.current[surfaceKey])
        );

        setHasDesignContent(surfaceKeys.some((surfaceKey) => snapshotHasObjects(snapshots[surfaceKey])));
        return snapshots;
    }, [surfaceKeys]);

    const restoreCurrentSurface = useCallback(async (canvas) => {
        const targetCanvas = canvas || canvasRef.current;
        const snapshot = surfaceDataRef.current[activeSurfaceRef.current];
        if (!targetCanvas || !snapshot) {
            refreshHasDesignContent();
            return false;
        }

        _isRestoringHistory.current = true;
        await targetCanvas.loadFromJSON(cloneSerializable(snapshot));
        ensureCanvasTextFonts(targetCanvas);
        targetCanvas.requestRenderAll();
        _isRestoringHistory.current = false;
        syncLayers();
        _refreshUndoRedo();
        refreshHasDesignContent();
        return true;
    }, [_refreshUndoRedo, ensureCanvasTextFonts, refreshHasDesignContent, syncLayers]);

    const saveProduct = useCallback(async () => {
        if (isSavingProduct) {
            return {
                ok: false,
                message: 'A save is already in progress. Please wait a moment.',
            };
        }

        const templateId = String(templateDef?.id || '').trim();
        if (!BACKEND_TEMPLATE_ID_PATTERN.test(templateId)) {
            return {
                ok: false,
                message: 'This editor session is not linked to a savable backend template.',
            };
        }

        if (!token) {
            return {
                ok: false,
                message: 'You need to sign in again before saving this product.',
            };
        }

        const snapshots = captureSurfaceSnapshots();
        const hasAnyDesign = surfaceKeys.some((surfaceKey) => snapshotHasObjects(snapshots[surfaceKey]));
        if (!hasAnyDesign) {
            return {
                ok: false,
                message: 'Add at least one design element before saving this product.',
            };
        }

        const selectedColor = shirtColors.find((color) => color.hex === shirtColor) || null;
        const now = new Date();
        const selection = {};
        if (selectedColor?.key) selection.colorKey = selectedColor.key;
        if (selectedColor?.label) selection.colorLabel = selectedColor.label;
        if (selectedColor?.hex || shirtColor) selection.colorHex = selectedColor?.hex || shirtColor;
        const nextProjectName = initialProjectName || buildProjectName(templateDef);
        const payload = {
            name: nextProjectName,
            templateId,
            surfaces: Object.fromEntries(
                surfaceKeys.map((surfaceKey) => [surfaceKey, {
                    canvasJson: snapshots[surfaceKey] || null,
                }])
            ),
            selection: Object.keys(selection).length > 0 ? selection : null,
            renderOptions: cloneSerializable(templateDef?.defaultRenderOptions || null),
            printPayloadRaw: {
                shirtColor,
                activeSurface: activeSurfaceRef.current,
                printAreas: cloneSerializable(surfacePrintAreas),
                surfaces: snapshots,
            },
            printPayloadNormalized: {
                templateId,
                productType: templateDef?.productType || DEFAULT_TEMPLATE_KEY,
                supportedSurfaces: [...surfaceKeys],
                activeSurface: activeSurfaceRef.current,
                shirtColor,
            },
            lastRenderedAt: now.toISOString(),
        };

        setIsSavingProduct(true);

        try {
            const response = initialProjectId
                ? await updateProject(token, initialProjectId, payload)
                : await createProject(token, payload);
            navigate('/dashboard?tab=products');
            return {
                ok: true,
                message: response?.message || (
                    initialProjectId ? 'Project updated successfully' : 'Project created successfully'
                ),
                project: response?.data?.project || null,
            };
        } catch (error) {
            console.error('Failed to save project', error);
            return {
                ok: false,
                error,
                message: error?.message || 'Unable to save this product right now.',
            };
        } finally {
            setIsSavingProduct(false);
        }
    }, [
        captureSurfaceSnapshots,
        isSavingProduct,
        initialProjectId,
        initialProjectName,
        shirtColor,
        shirtColors,
        surfaceKeys,
        surfacePrintAreas,
        templateDef,
        token,
    ]);

    const enterPreviewMode = useCallback(() => {
        captureSurfaceSnapshots();
        setSelectedLayerId(null);
        setSelectedObjectType(null);
        selectedObjectRef.current = null;
        setTextStyle({
            fontSize: 28,
            fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
            fill: '#222222',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textAlign: 'left',
            isText: false,
        });
        setIsPreviewMode(true);
    }, [captureSurfaceSnapshots]);

    const exitPreviewMode = useCallback(() => {
        setIsPreviewMode(false);
    }, []);

    /* ── undo / redo ─────────────────────────────────────────────── */

    const undo = useCallback(async () => {
        const canvas = canvasRef.current;
        const h = historyRef.current[activeSurface] || { stack: [], pointer: -1 };
        if (!canvas || h.pointer <= 0) return;
        _isRestoringHistory.current = true;
        h.pointer--;
        await canvas.loadFromJSON(h.stack[h.pointer]);
        ensureCanvasTextFonts(canvas);
        canvas.requestRenderAll();
        _isRestoringHistory.current = false;
        syncLayers();
        _refreshUndoRedo();
    }, [activeSurface, ensureCanvasTextFonts, syncLayers, _refreshUndoRedo]);

    const redo = useCallback(async () => {
        const canvas = canvasRef.current;
        const h = historyRef.current[activeSurface] || { stack: [], pointer: -1 };
        if (!canvas || h.pointer >= h.stack.length - 1) return;
        _isRestoringHistory.current = true;
        h.pointer++;
        await canvas.loadFromJSON(h.stack[h.pointer]);
        ensureCanvasTextFonts(canvas);
        canvas.requestRenderAll();
        _isRestoringHistory.current = false;
        syncLayers();
        _refreshUndoRedo();
    }, [activeSurface, ensureCanvasTextFonts, syncLayers, _refreshUndoRedo]);

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
        ensureCanvasTextFonts(canvas);
        if (!surfaceDataRef.current[activeSurfaceRef.current]) syncLayers();
        refreshHasDesignContent();
    }, [ensureCanvasTextFonts, refreshHasDesignContent, syncLayers, _constrainObject, _triggerAutoSave]);

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
        const next = Number(factor);
        if (!Number.isFinite(next)) return;
        const clamped = Math.min(SCENE_ZOOM_MAX, Math.max(SCENE_ZOOM_MIN, next));
        setZoomLevel(clamped);
    }, []);

    const zoomIn = useCallback(() => applyZoom(zoomLevel * SCENE_ZOOM_STEP), [applyZoom, zoomLevel]);
    const zoomOut = useCallback(() => applyZoom(zoomLevel / SCENE_ZOOM_STEP), [applyZoom, zoomLevel]);

    const centerObjectInPrintArea = useCallback((obj, printArea) => {
        if (!obj || !printArea) return;

        obj.setPositionByOrigin(
            new Point(
                (Number(printArea.x) || 0) + (Number(printArea.width) || 0) / 2,
                (Number(printArea.y) || 0) + (Number(printArea.height) || 0) / 2
            ),
            'center',
            'center'
        );
        obj.setCoords();
    }, []);

    /* ── alignment (relative to printArea) ──────────────────────── */
    const alignObject = useCallback((alignment) => {
        const canvas = canvasRef.current;
        const obj = selectedObjectRef.current;
        if (!canvas || !obj) return;

        const pa = _getPrintArea();
        const bRect = obj.getBoundingRect();
        const center = obj.getCenterPoint();
        const boundsLeft = Number(bRect.left ?? bRect.x) || 0;
        const boundsTop = Number(bRect.top ?? bRect.y) || 0;
        const boundsWidth = Number(bRect.width) || 0;
        const boundsHeight = Number(bRect.height) || 0;
        const printAreaLeft = Number(pa.x) || 0;
        const printAreaTop = Number(pa.y) || 0;
        const printAreaRight = printAreaLeft + (Number(pa.width) || 0);
        const printAreaBottom = printAreaTop + (Number(pa.height) || 0);
        const printAreaCenterX = printAreaLeft + ((Number(pa.width) || 0) / 2);
        const printAreaCenterY = printAreaTop + ((Number(pa.height) || 0) / 2);
        let deltaX = 0;
        let deltaY = 0;

        switch (alignment) {
            case 'left':
                deltaX = printAreaLeft - boundsLeft;
                break;
            case 'right':
                deltaX = printAreaRight - (boundsLeft + boundsWidth);
                break;
            case 'top':
                deltaY = printAreaTop - boundsTop;
                break;
            case 'bottom':
                deltaY = printAreaBottom - (boundsTop + boundsHeight);
                break;
            case 'centerH':
                deltaX = printAreaCenterX - (Number(center.x) || 0);
                break;
            case 'centerV':
                deltaY = printAreaCenterY - (Number(center.y) || 0);
                break;
            default: break;
        }

        obj.setPositionByOrigin(
            new Point(
                (Number(center.x) || 0) + deltaX,
                (Number(center.y) || 0) + deltaY
            ),
            'center',
            'center'
        );
        obj.setCoords();
        canvas.requestRenderAll();
        pushHistory();
    }, [_getPrintArea, pushHistory]);

    /* ── add objects ─────────────────────────────────────────────── */

    const addText = useCallback(async (fontInput) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const pa = _getPrintArea();
        const unitScale = _getObjectUnitScale();
        const requestedFamily = typeof fontInput === 'string' ? fontInput : fontInput?.family;
        const nextFontFamily = normalizeFontFamily(requestedFamily);
        const requestedFontWeight = typeof fontInput === 'object' ? fontInput?.fontWeight : 400;
        const requestedFontStyle = typeof fontInput === 'object' ? fontInput?.fontStyle : 'normal';
        const fontEntry = (typeof fontInput === 'object' && fontInput?.family)
            ? {
                family: nextFontFamily,
                variants: Array.isArray(fontInput.variants) ? fontInput.variants : [],
                category: fontInput.category,
            }
            : (findEditorFontByFamily(availableFontsRef.current, nextFontFamily) || {
                family: nextFontFamily,
                variants: [],
            });
        const defaultVariant = pickEditorFontVariant(fontEntry, {
            fontWeight: requestedFontWeight,
            fontStyle: requestedFontStyle,
        });
        const nextFontWeight = normalizeFontWeight(defaultVariant?.fontWeight ?? requestedFontWeight);
        const nextFontStyle = normalizeFontStyle(defaultVariant?.fontStyle ?? requestedFontStyle);
        await loadFontFamily(nextFontFamily, {
            fontWeight: nextFontWeight,
            fontStyle: nextFontStyle,
        });
        const text = new IText('Your text here', {
            left: pa.x + pa.width / 2,
            top: pa.y + pa.height / 2,
            originX: 'center',
            originY: 'center',
            fontSize: Math.round(32 * unitScale),
            fontFamily: nextFontFamily,
            fontWeight: nextFontWeight,
            fontStyle: nextFontStyle,
            fill: '#222222',
        });
        text._layerType = 'text';
        text._coordinateOrigin = 'scene';
        text.coordinateOrigin = 'scene';
        refreshTextObjectLayout(text);
        canvas.add(text);
        centerObjectInPrintArea(text, pa);
        canvas.setActiveObject(text);
        canvas.requestRenderAll();
        syncLayers();
        pushHistory();

        const startEditingText = () => {
            if (!canvasRef.current || canvasRef.current !== canvas || canvas.disposed || canvas.destroyed) {
                return;
            }

            canvas.setActiveObject(text);
            text.enterEditing();
            text.selectAll();
            text.hiddenTextarea?.focus?.();
            text.hiddenTextarea?.select?.();
            canvas.requestRenderAll();
        };

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(startEditingText);
        } else {
            setTimeout(startEditingText, 0);
        }
    }, [centerObjectInPrintArea, loadFontFamily, refreshTextObjectLayout, syncLayers, pushHistory, _getPrintArea, _getObjectUnitScale]);

    const _placeImageOnCanvas = useCallback((imageSource, name, metadata = {}) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const imgEl = new Image();
        if (/^https?:\/\//i.test(String(imageSource || ''))) {
            imgEl.crossOrigin = 'anonymous';
        }
        imgEl.onload = async () => {
            const pa = _getPrintArea();
            const unitScale = _getObjectUnitScale();
            const fabricImg = new FabricImage(imgEl, {
                originX: 'center',
                originY: 'center',
                left: pa.x + pa.width / 2,
                top: pa.y + pa.height / 2,
            });
            fabricImg._imageName = name;
            fabricImg.imageName = name;
            fabricImg._layerType = 'image';
            fabricImg.layerType = 'image';
            fabricImg._coordinateOrigin = 'scene';
            fabricImg.coordinateOrigin = 'scene';
            fabricImg._assetId = metadata.assetId || '';
            fabricImg.assetId = metadata.assetId || '';
            fabricImg._assetUrl = metadata.assetUrl || '';
            fabricImg.assetUrl = metadata.assetUrl || '';
            fabricImg._sourceMimeType = metadata.sourceMimeType || '';
            fabricImg.sourceMimeType = metadata.sourceMimeType || '';
            const sourceW = fabricImg.width || 1;
            const sourceH = fabricImg.height || 1;
            const preferredW = pa.width * 0.6;
            const preferredH = pa.height * 0.6;
            const maxW = pa.width * 0.85;
            const maxH = pa.height * 0.85;
            const preferredScale = Math.min(preferredW / sourceW, preferredH / sourceH);
            const maxScale = Math.min(maxW / sourceW, maxH / sourceH);
            const nextScale = Math.min(maxScale, Math.max(preferredScale * 2, 0.05));
            if (Number.isFinite(nextScale) && nextScale > 0) {
                fabricImg.scaleX = nextScale;
                fabricImg.scaleY = nextScale;
            }
            canvas.add(fabricImg);
            centerObjectInPrintArea(fabricImg, pa);
            canvas.setActiveObject(fabricImg);
            canvas.requestRenderAll();
            syncLayers();
            pushHistory();
        };
        imgEl.src = imageSource;
    }, [centerObjectInPrintArea, syncLayers, pushHistory, _getPrintArea, _getObjectUnitScale]);

    const addImage = useCallback(async (file) => {
        const canvas = canvasRef.current;
        if (!canvas || !file) {
            setUploadedImagesError('Editor canvas is not ready yet.');
            return {
                ok: false,
                message: 'Editor canvas is not ready yet.',
            };
        }

        if (!token) {
            setUploadedImagesError('Sign in to upload images to the backend library.');
            return {
                ok: false,
                message: 'Sign in to upload images to the backend library.',
            };
        }

        setIsUploadingImage(true);
        setUploadedImagesError('');

        try {
            const payload = await uploadAssetRequest(token, file);
            const normalizedAsset = normalizeUploadedImageEntry(payload?.data);

            if (!normalizedAsset) {
                throw new Error('Uploaded asset metadata is invalid.');
            }

            setUploadedImages((prev) => {
                const nextItems = prev.filter((item) => item.id !== normalizedAsset.id);
                return [normalizedAsset, ...nextItems];
            });

            _placeImageOnCanvas(normalizedAsset.renderUrl, normalizedAsset.name, {
                assetId: normalizedAsset.id,
                assetUrl: normalizedAsset.url,
                sourceMimeType: normalizedAsset.mimeType || file.type || '',
            });

            return {
                ok: true,
                asset: normalizedAsset,
            };
        } catch (error) {
            setUploadedImagesError(error?.message || 'Unable to upload image.');
            return {
                ok: false,
                error,
                message: error?.message || 'Unable to upload image.',
            };
        } finally {
            setIsUploadingImage(false);
        }
    }, [_placeImageOnCanvas, token]);

    const addImageFromDataUrl = useCallback((imageSource, name, metadata = {}) => {
        _placeImageOnCanvas(imageSource, name, metadata);
    }, [_placeImageOnCanvas]);

    const deleteUploadedImage = useCallback(async (assetId) => {
        const normalizedAssetId = String(assetId || '').trim();
        if (!normalizedAssetId) {
            return {
                ok: false,
                message: 'Asset id is required.',
            };
        }

        if (!token) {
            setUploadedImagesError('Sign in to delete images from the backend library.');
            return {
                ok: false,
                message: 'Sign in to delete images from the backend library.',
            };
        }

        setDeletingAssetId(normalizedAssetId);
        setUploadedImagesError('');

        try {
            await deleteAssetRequest(token, normalizedAssetId);
            setUploadedImages((prev) => prev.filter((item) => item.id !== normalizedAssetId));
            return {
                ok: true,
            };
        } catch (error) {
            const message = error?.message || 'Unable to delete image.';
            setUploadedImagesError(message);
            return {
                ok: false,
                error,
                message,
            };
        } finally {
            setDeletingAssetId('');
        }
    }, [token]);

    const addShape = useCallback((shapeInput) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const shapeRecord = typeof shapeInput === 'object' && shapeInput?.geometry?.pathCommands
            ? shapeInput
            : availableShapes.find((item) => (
                item.slug === String(shapeInput || '').trim().toLowerCase()
                || item.name.toLowerCase() === String(shapeInput || '').trim().toLowerCase()
            ));

        if (!shapeRecord?.geometry?.pathCommands) {
            return;
        }

        const pa = _getPrintArea();
        const unitScale = _getObjectUnitScale();
        const baseOpts = {
            left: pa.x + pa.width / 2,
            top: pa.y + pa.height / 2,
            fill: DEFAULT_SHAPE_COLOR_HEX,
            stroke: null,
            strokeWidth: 0,
            originX: 'center',
            originY: 'center',
        };

        const shape = new Path(shapeRecord.geometry.pathCommands, baseOpts);
        const sourceWidth = Math.max(1, Number(shape.width) || 1);
        const sourceHeight = Math.max(1, Number(shape.height) || 1);
        const dominantDimension = Math.max(sourceWidth, sourceHeight);
        const targetSize = Math.max(48, 120 * unitScale);
        const nextScale = targetSize / dominantDimension;

        shape.set({
            scaleX: nextScale,
            scaleY: nextScale,
        });
        shape._shapeType = shapeRecord.name;
        shape._shapeId = shapeRecord.id;
        shape.shapeId = shapeRecord.id;
        shape._shapeSlug = shapeRecord.slug;
        shape.shapeSlug = shapeRecord.slug;
        shape._shapePathCommands = shapeRecord.geometry.pathCommands;
        shape.shapePathCommands = shapeRecord.geometry.pathCommands;
        shape._shapeSourceWidth = sourceWidth;
        shape.shapeSourceWidth = sourceWidth;
        shape._shapeSourceHeight = sourceHeight;
        shape.shapeSourceHeight = sourceHeight;
        shape._layerType = 'shape';
        shape._coordinateOrigin = 'scene';
        shape.coordinateOrigin = 'scene';
        canvas.add(shape);
        centerObjectInPrintArea(shape, pa);
        canvas.setActiveObject(shape);
        canvas.requestRenderAll();
        syncLayers();
        pushHistory();
    }, [availableShapes, centerObjectInPrintArea, syncLayers, pushHistory, _getPrintArea, _getObjectUnitScale]);

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
        if (active._shapeId || active.shapeId) {
            clone._shapeId = active._shapeId || active.shapeId;
            clone.shapeId = active.shapeId || active._shapeId;
        }
        if (active._shapeSlug || active.shapeSlug) {
            clone._shapeSlug = active._shapeSlug || active.shapeSlug;
            clone.shapeSlug = active.shapeSlug || active._shapeSlug;
        }
        if (active._shapePathCommands || active.shapePathCommands) {
            clone._shapePathCommands = active._shapePathCommands || active.shapePathCommands;
            clone.shapePathCommands = active.shapePathCommands || active._shapePathCommands;
        }
        if (active._shapeSourceWidth || active.shapeSourceWidth) {
            clone._shapeSourceWidth = active._shapeSourceWidth || active.shapeSourceWidth;
            clone.shapeSourceWidth = active.shapeSourceWidth || active._shapeSourceWidth;
        }
        if (active._shapeSourceHeight || active.shapeSourceHeight) {
            clone._shapeSourceHeight = active._shapeSourceHeight || active.shapeSourceHeight;
            clone.shapeSourceHeight = active.shapeSourceHeight || active._shapeSourceHeight;
        }
        if (active._imageName || active.imageName) {
            clone._imageName = active._imageName || active.imageName;
            clone.imageName = active.imageName || active._imageName;
        }
        if (active._layerType || active.layerType) {
            clone._layerType = active._layerType || active.layerType;
            clone.layerType = active.layerType || active._layerType;
        }
        if (active._assetId || active.assetId) {
            clone._assetId = active._assetId || active.assetId;
            clone.assetId = active.assetId || active._assetId;
        }
        if (active._assetUrl || active.assetUrl) {
            clone._assetUrl = active._assetUrl || active.assetUrl;
            clone.assetUrl = active.assetUrl || active._assetUrl;
        }
        if (active._sourceMimeType || active.sourceMimeType) {
            clone._sourceMimeType = active._sourceMimeType || active.sourceMimeType;
            clone.sourceMimeType = active.sourceMimeType || active._sourceMimeType;
        }
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
        if (!canvas || !surfaceKeys.includes(target) || target === fromSurface) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

        _isRestoringHistory.current = true;
        surfaceDataRef.current[fromSurface] = canvas.toJSON(CUSTOM_PROPS);
        canvas.clear();
        const targetJson = surfaceDataRef.current[target];
        if (targetJson) await canvas.loadFromJSON(targetJson);
        ensureCanvasTextFonts(canvas);
        canvas.backgroundColor = '#ffffff';
        canvas.requestRenderAll();
        _isRestoringHistory.current = false;

        activeSurfaceRef.current = target;
        setActiveSurface(target);
        setSelectedLayerId(null);
        setSelectedObjectType(null);
        selectedObjectRef.current = null;
        syncLayers();
        refreshHasDesignContent();
        const th = historyRef.current[target] || { stack: [], pointer: -1 };
        setCanUndo(th.pointer > 0);
        setCanRedo(th.pointer < th.stack.length - 1);
    }, [ensureCanvasTextFonts, refreshHasDesignContent, surfaceKeys, syncLayers]);

    /* ── value ───────────────────────────────────────────────────── */

    const value = {
        canvasRef,
        layers, selectedLayerId, setSelectedLayerId,
        setCanvas, syncLayers,
        addText, addImage, addImageFromDataUrl, deleteUploadedImage, addShape,
        selectLayer, deleteLayer, deleteSelected, duplicateSelected,
        updateObjectTransform, alignObject,
        activeSurface, surfaces: surfaceKeys, surfaceDefs, switchSurface,
        pushHistory, undo, redo, canUndo, canRedo,
        reorderLayers,
        textStyle, setSelectedObject, updateTextStyle,
        selectedObjectType,
        availableFonts, fontsLoading, fontsError, loadFontFamily,
        availableShapes, shapesLoading, shapesError, shapesLoaded, loadAvailableShapes,
        uploadedImages, uploadedImagesLoading, uploadedImagesError, isUploadingImage, deletingAssetId,
        shirtColor, setShirtColor,
        shirtColors, shirtColorsLoading, shirtColorsError,
        templateDef,
        printArea: _getPrintArea(),
        surfacePrintAreas,
        setSurfacePrintArea,
        captureSurfaceSnapshots,
        restoreCurrentSurface,
        saveProduct,
        hasDesignContent,
        isSavingProduct,
        isPreviewMode, setIsPreviewMode, enterPreviewMode, exitPreviewMode,
        isPanMode, togglePanMode,
        zoomMin: SCENE_ZOOM_MIN,
        zoomMax: SCENE_ZOOM_MAX,
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
