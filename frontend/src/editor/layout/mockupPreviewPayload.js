import {
    Circle,
    FabricImage,
    IText,
    Path,
    Polygon,
    Rect,
    StaticCanvas,
    Triangle,
    util,
} from 'fabric';

const BACKEND_TEMPLATE_ID_PATTERN = /^[a-f\d]{24}$/i;
const DEFAULT_OUTPUT_SIZE = 2400;
const MAX_OUTPUT_SIZE = 4096;
const DEFAULT_OUTPUT_FORMAT = 'png';
const SUPPORTED_FORMATS = new Set(['png', 'jpeg', 'jpg', 'webp']);

function roundDimension(value, fallback = 1) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return fallback;
    }

    return Math.max(1, Math.round(numericValue));
}

function roundFloat(value, digits = 4) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return 0;
    }

    const multiplier = 10 ** digits;
    return Math.round(numericValue * multiplier) / multiplier;
}

function normalizeFormat(format) {
    const value = String(format || '').trim().toLowerCase();
    return SUPPORTED_FORMATS.has(value) ? value : DEFAULT_OUTPUT_FORMAT;
}

function normalizeHex(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return '';
    return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

function resolveSceneSize(surfaceDef, printArea) {
    return {
        sceneWidth: roundDimension(surfaceDef?.sceneWidth, roundDimension(printArea?.width)),
        sceneHeight: roundDimension(surfaceDef?.sceneHeight, roundDimension(printArea?.height)),
    };
}

function resolveSurfacePosition(surfaceKey, surfaceDef) {
    return String(surfaceDef?.position || (surfaceKey === 'neckLabelInner' ? 'neck' : surfaceKey)).trim();
}

function resolvePlaceholderId(surfaceKey, surfaceDef) {
    return String(surfaceDef?.placeholderId || `placeholder_${surfaceKey}`).trim();
}

function resolveSurfaceDomIds(surfaceKey, surfaceDef) {
    const domIds = Array.isArray(surfaceDef?.domId)
        ? surfaceDef.domId.map((value) => String(value || '').trim()).filter(Boolean)
        : [];

    return domIds.length > 0 ? domIds : [`#${resolvePlaceholderId(surfaceKey, surfaceDef)}`];
}

function resolveDecorationMethod(surfaceDef) {
    const allowedDecorationMethods = Array.isArray(surfaceDef?.allowedDecorationMethods)
        ? surfaceDef.allowedDecorationMethods.map((value) => String(value || '').trim()).filter(Boolean)
        : [];

    return String(allowedDecorationMethods[0] || 'dtg').trim() || 'dtg';
}

function clampOutputSize(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return DEFAULT_OUTPUT_SIZE;
    }

    return Math.min(MAX_OUTPUT_SIZE, Math.max(1, Math.round(numericValue)));
}

function resolveFileExtension({ format, mimeType }) {
    const normalizedFormat = normalizeFormat(format);
    if (normalizedFormat !== 'png') {
        return normalizedFormat === 'jpg' ? 'jpeg' : normalizedFormat;
    }

    const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
    if (normalizedMimeType === 'image/jpeg') return 'jpeg';
    if (normalizedMimeType === 'image/webp') return 'webp';
    return 'png';
}

function resolveSelectedColorKey(shirtColor, shirtColors) {
    const normalizedShirtColor = normalizeHex(shirtColor);
    if (!normalizedShirtColor || !Array.isArray(shirtColors)) {
        return '';
    }

    const selectedColor = shirtColors.find((color) => normalizeHex(color?.hex) === normalizedShirtColor);
    return String(selectedColor?.label || selectedColor?.key || '').trim().toLowerCase();
}

function getAbsoluteScale(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue === 0) {
        return 1;
    }

    return Math.abs(numericValue);
}

function resolveObjectCustomProp(object, snapshotObject, ...keys) {
    for (const key of keys) {
        const objectValue = object?.[key];
        if (objectValue !== undefined && objectValue !== null && objectValue !== '') {
            return objectValue;
        }

        const snapshotValue = snapshotObject?.[key];
        if (snapshotValue !== undefined && snapshotValue !== null && snapshotValue !== '') {
            return snapshotValue;
        }
    }

    return undefined;
}

function createAssetLookup(uploadedImages) {
    const lookup = new Map();

    (Array.isArray(uploadedImages) ? uploadedImages : []).forEach((item) => {
        const assetId = String(item?.id || '').trim();
        if (!assetId) return;

        [
            item?.id,
            item?.url,
            item?.renderUrl,
            item?.originalName,
            item?.name,
        ].forEach((value) => {
            const key = String(value || '').trim();
            if (key) {
                lookup.set(key, assetId);
            }
        });
    });

    return lookup;
}

function resolveAssetIdFromLookup(assetLookup, ...candidates) {
    for (const candidate of candidates) {
        const normalizedCandidate = String(candidate || '').trim();
        if (!normalizedCandidate) continue;

        const matchedAssetId = assetLookup.get(normalizedCandidate);
        if (matchedAssetId) {
            return matchedAssetId;
        }
    }

    return '';
}

function getObjectCenterPoint(object) {
    if (typeof object?.getCenterPoint === 'function') {
        return object.getCenterPoint();
    }

    return {
        x: (Number(object?.left) || 0) + ((Number(object?.width) || 0) * getAbsoluteScale(object?.scaleX)) / 2,
        y: (Number(object?.top) || 0) + ((Number(object?.height) || 0) * getAbsoluteScale(object?.scaleY)) / 2,
    };
}

function resolveSnapshotCoordinateOrigin(objects, printArea) {
    if (!Array.isArray(objects) || objects.length === 0) {
        return 'scene';
    }

    const printAreaX = Number(printArea?.x) || 0;
    const printAreaY = Number(printArea?.y) || 0;
    const slackX = Math.max(24, Math.min(200, (Number(printArea?.width) || 0) * 0.08));
    const slackY = Math.max(24, Math.min(240, (Number(printArea?.height) || 0) * 0.08));

    let localEvidence = 0;

    objects.forEach((object) => {
        const center = getObjectCenterPoint(object);
        if ((Number(center?.x) || 0) < printAreaX - slackX || (Number(center?.y) || 0) < printAreaY - slackY) {
            localEvidence += 1;
        }
    });

    return localEvidence >= Math.ceil(objects.length / 2) ? 'local' : 'scene';
}

function resolveObjectCoordinateOrigin(object, snapshotObject, fallbackOrigin = 'scene') {
    const explicitOrigin = String(
        resolveObjectCustomProp(object, snapshotObject, '_coordinateOrigin', 'coordinateOrigin') || ''
    ).trim().toLowerCase();

    if (explicitOrigin === 'local' || explicitOrigin === 'scene') {
        return explicitOrigin;
    }

    return fallbackOrigin;
}

function getLayerBasePayload(object, printArea, snapshotObject, coordinateOrigin = 'scene') {
    const center = getObjectCenterPoint(object);
    const printAreaX = coordinateOrigin === 'local' ? 0 : Number(printArea?.x) || 0;
    const printAreaY = coordinateOrigin === 'local' ? 0 : Number(printArea?.y) || 0;

    return {
        id: resolveObjectCustomProp(object, snapshotObject, '_layerId', 'layerId'),
        x: roundFloat((center.x - printAreaX) / Math.max(1, Number(printArea?.width) || 1)),
        y: roundFloat((center.y - printAreaY) / Math.max(1, Number(printArea?.height) || 1)),
        angle: roundFloat(object?.angle || 0, 3),
        scale: 1,
        flipX: Boolean(object?.flipX),
        flipY: Boolean(object?.flipY),
    };
}

function getScaledDimensions(object) {
    const fallbackWidth = (Number(object?.width) || 1) * getAbsoluteScale(object?.scaleX);
    const fallbackHeight = (Number(object?.height) || 1) * getAbsoluteScale(object?.scaleY);

    return {
        width: roundFloat(
            typeof object?.getScaledWidth === 'function' ? object.getScaledWidth() : fallbackWidth,
            3
        ),
        height: roundFloat(
            typeof object?.getScaledHeight === 'function' ? object.getScaledHeight() : fallbackHeight,
            3
        ),
    };
}

function createRoundedRectPath(width, height, rx = 0, ry = 0) {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const safeRx = Math.min(Math.max(0, rx), safeWidth / 2);
    const safeRy = Math.min(Math.max(0, ry), safeHeight / 2);

    if (safeRx <= 0 || safeRy <= 0) {
        return `M0 0H${safeWidth}V${safeHeight}H0Z`;
    }

    return [
        `M${safeRx} 0`,
        `H${safeWidth - safeRx}`,
        `A${safeRx} ${safeRy} 0 0 1 ${safeWidth} ${safeRy}`,
        `V${safeHeight - safeRy}`,
        `A${safeRx} ${safeRy} 0 0 1 ${safeWidth - safeRx} ${safeHeight}`,
        `H${safeRx}`,
        `A${safeRx} ${safeRy} 0 0 1 0 ${safeHeight - safeRy}`,
        `V${safeRy}`,
        `A${safeRx} ${safeRy} 0 0 1 ${safeRx} 0`,
        'Z',
    ].join('');
}

function createEllipsePath(width, height) {
    const rx = roundFloat(Math.max(1, width) / 2, 3);
    const ry = roundFloat(Math.max(1, height) / 2, 3);
    return `M${rx} 0A${rx} ${ry} 0 1 1 ${rx} ${ry * 2}A${rx} ${ry} 0 1 1 ${rx} 0Z`;
}

function createTrianglePath(width, height) {
    const safeWidth = roundFloat(Math.max(1, width), 3);
    const safeHeight = roundFloat(Math.max(1, height), 3);
    return `M${safeWidth / 2} 0L${safeWidth} ${safeHeight}L0 ${safeHeight}Z`;
}

function createPolygonPath(points, width, height) {
    if (!Array.isArray(points) || points.length === 0) {
        return '';
    }

    const minX = Math.min(...points.map((point) => Number(point?.x) || 0));
    const minY = Math.min(...points.map((point) => Number(point?.y) || 0));
    const maxX = Math.max(...points.map((point) => Number(point?.x) || 0));
    const maxY = Math.max(...points.map((point) => Number(point?.y) || 0));
    const sourceWidth = Math.max(1, maxX - minX);
    const sourceHeight = Math.max(1, maxY - minY);
    const scaleX = Math.max(1, width) / sourceWidth;
    const scaleY = Math.max(1, height) / sourceHeight;

    return `${points.map((point, index) => {
        const x = roundFloat(((Number(point?.x) || 0) - minX) * scaleX, 3);
        const y = roundFloat(((Number(point?.y) || 0) - minY) * scaleY, 3);
        return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    }).join('')}Z`;
}

function serializeShapeStroke(object) {
    if (!object?.stroke) {
        return null;
    }

    return {
        color: String(object.stroke),
        width: roundFloat(Number(object.strokeWidth) || 0, 3),
    };
}

function scalePathCommands(pathCommands, sourceWidth, sourceHeight, targetWidth, targetHeight) {
    const normalizedPathCommands = String(pathCommands || '').trim();
    if (!normalizedPathCommands) {
        return '';
    }

    const safeSourceWidth = Math.max(1, Number(sourceWidth) || 1);
    const safeSourceHeight = Math.max(1, Number(sourceHeight) || 1);
    const safeTargetWidth = Math.max(1, Number(targetWidth) || 1);
    const safeTargetHeight = Math.max(1, Number(targetHeight) || 1);
    const scaleX = safeTargetWidth / safeSourceWidth;
    const scaleY = safeTargetHeight / safeSourceHeight;

    if (Math.abs(scaleX - 1) < 0.0001 && Math.abs(scaleY - 1) < 0.0001) {
        return normalizedPathCommands;
    }

    const parsedPath = util.makePathSimpler(util.parsePath(normalizedPathCommands));
    const transformedPath = util.transformPath(
        parsedPath,
        [scaleX, 0, 0, scaleY, 0, 0],
    );

    return util.joinPath(transformedPath, 3);
}

function getPathCommandsFromObject(object) {
    if (!Array.isArray(object?.path) || object.path.length === 0) {
        return '';
    }

    try {
        return util.joinPath(object.path, 3);
    } catch {
        return '';
    }
}

function serializeShapeObject(object, printArea, objectIndex, snapshotObject, coordinateOrigin) {
    const dimensions = getScaledDimensions(object);
    const base = getLayerBasePayload(object, printArea, snapshotObject, coordinateOrigin);
    const scaleX = getAbsoluteScale(object?.scaleX);
    const scaleY = getAbsoluteScale(object?.scaleY);
    const rawType = String(object?.type || '').toLowerCase();
    const shapeId = resolveObjectCustomProp(object, snapshotObject, '_shapeId', 'shapeId') || undefined;
    const shapeSlug = resolveObjectCustomProp(object, snapshotObject, '_shapeSlug', 'shapeSlug') || undefined;
    let pathCommands = '';

    if (object instanceof Path || rawType === 'path') {
        const sourcePathCommands =
            resolveObjectCustomProp(object, snapshotObject, '_shapePathCommands', 'shapePathCommands')
            || getPathCommandsFromObject(object);
        const sourceWidth =
            resolveObjectCustomProp(object, snapshotObject, '_shapeSourceWidth', 'shapeSourceWidth')
            || Number(object?.width)
            || dimensions.width;
        const sourceHeight =
            resolveObjectCustomProp(object, snapshotObject, '_shapeSourceHeight', 'shapeSourceHeight')
            || Number(object?.height)
            || dimensions.height;

        pathCommands = scalePathCommands(
            sourcePathCommands,
            sourceWidth,
            sourceHeight,
            dimensions.width,
            dimensions.height,
        );
    } else if (object instanceof Rect || rawType === 'rect') {
        pathCommands = createRoundedRectPath(
            dimensions.width,
            dimensions.height,
            roundFloat((Number(object?.rx) || 0) * scaleX, 3),
            roundFloat((Number(object?.ry) || 0) * scaleY, 3)
        );
    } else if (object instanceof Circle || rawType === 'circle') {
        pathCommands = createEllipsePath(dimensions.width, dimensions.height);
    } else if (object instanceof Triangle || rawType === 'triangle') {
        pathCommands = createTrianglePath(dimensions.width, dimensions.height);
    } else if (object instanceof Polygon || rawType === 'polygon') {
        pathCommands = createPolygonPath(object?.points || [], dimensions.width, dimensions.height);
    }

    if (!pathCommands) {
        return null;
    }

    return {
        ...base,
        id: base.id || `shape-${objectIndex + 1}`,
        layerType: 'shape',
        shapeId,
        shapeSlug,
        width: dimensions.width,
        height: dimensions.height,
        fill: {
            type: 'solid',
            color: String(object?.fill || '#000000'),
        },
        stroke: serializeShapeStroke(object),
        ...(shapeId ? {} : { pathCommands }),
    };
}

function serializeTextObject(object, printArea, objectIndex, snapshotObject, coordinateOrigin) {
    const dimensions = getScaledDimensions(object);
    const base = getLayerBasePayload(object, printArea, snapshotObject, coordinateOrigin);
    const scaleY = getAbsoluteScale(object?.scaleY);
    const fontSize = Math.max(1, (Number(object?.fontSize) || 16) * scaleY);
    const lineHeight = Math.max(1, fontSize * (Number(object?.lineHeight) || 1.16));

    return {
        ...base,
        id: base.id || `text-${objectIndex + 1}`,
        layerType: 'text',
        width: dimensions.width,
        height: dimensions.height,
        color: String(object?.fill || '#111111'),
        textAlign: ['left', 'center', 'right'].includes(object?.textAlign) ? object.textAlign : 'left',
        fontFamily: String(object?.fontFamily || 'Arial'),
        fontWeight: object?.fontWeight ?? 400,
        fontStyle: String(object?.fontStyle || 'normal'),
        lineHeight: roundFloat(lineHeight, 3),
        baselineFontSize: roundFloat(fontSize, 3),
        textInput: String(object?.text || ''),
        name: String(object?.text || '').slice(0, 60) || 'Text',
    };
}

async function serializeImageObject(object, printArea, objectIndex, snapshotObject, assetLookup, coordinateOrigin) {
    const assetId = String(
        resolveObjectCustomProp(object, snapshotObject, '_assetId', 'assetId')
        || resolveAssetIdFromLookup(
            assetLookup,
            resolveObjectCustomProp(object, snapshotObject, '_assetUrl', 'assetUrl'),
            object?.getSrc?.(),
            object?._originalElement?.currentSrc,
            object?._originalElement?.src,
            object?.src,
            resolveObjectCustomProp(object, snapshotObject, '_imageName', 'imageName', 'name')
        )
        || ''
    ).trim();

    if (!assetId) {
        throw new Error('Preview image is missing assetId. Please add the image from Library again before previewing.');
    }

    const dimensions = getScaledDimensions(object);
    const base = getLayerBasePayload(object, printArea, snapshotObject, coordinateOrigin);
    const imageName = resolveObjectCustomProp(object, snapshotObject, '_imageName', 'name') || 'Image';

    return {
        ...base,
        id: base.id || `image-${objectIndex + 1}`,
        layerType: 'image',
        width: dimensions.width,
        height: dimensions.height,
        assetId,
        sourceMimeType: resolveObjectCustomProp(object, snapshotObject, '_sourceMimeType', 'sourceMimeType') || undefined,
        fileName: imageName || undefined,
        name: imageName,
    };
}

async function serializeCanvasObject(object, printArea, objectIndex, snapshotObject, assetLookup, coordinateOrigin) {
    if (object instanceof IText || String(object?.type || '').toLowerCase() === 'i-text') {
        return serializeTextObject(object, printArea, objectIndex, snapshotObject, coordinateOrigin);
    }

    if (object instanceof FabricImage || String(object?.type || '').toLowerCase() === 'image') {
        return serializeImageObject(object, printArea, objectIndex, snapshotObject, assetLookup, coordinateOrigin);
    }

    return serializeShapeObject(object, printArea, objectIndex, snapshotObject, coordinateOrigin);
}

async function serializeSurfaceLayers(snapshot, surfaceDef, printArea, uploadedImages) {
    const objects = Array.isArray(snapshot?.objects) ? snapshot.objects : [];
    if (objects.length === 0) {
        return [];
    }

    const assetLookup = createAssetLookup(uploadedImages);

    const { sceneWidth, sceneHeight } = resolveSceneSize(surfaceDef, printArea);
    const canvas = new StaticCanvas(undefined, {
        width: sceneWidth,
        height: sceneHeight,
        backgroundColor: 'rgba(0,0,0,0)',
        enableRetinaScaling: false,
        renderOnAddRemove: false,
    });

    try {
        await canvas.loadFromJSON(snapshot);

        if (typeof document !== 'undefined' && document.fonts?.ready) {
            try {
                await document.fonts.ready;
            } catch {
                // Keep rendering with the font faces currently available in the browser.
            }
        }

        canvas.requestRenderAll();

        const layers = [];
        const canvasObjects = canvas.getObjects();
        const coordinateOrigin = resolveSnapshotCoordinateOrigin(canvasObjects, printArea);

        for (let index = 0; index < canvasObjects.length; index += 1) {
            const snapshotObject = objects[index] || null;
            const objectCoordinateOrigin = resolveObjectCoordinateOrigin(
                canvasObjects[index],
                snapshotObject,
                coordinateOrigin
            );
            const layer = await serializeCanvasObject(
                canvasObjects[index],
                printArea,
                index,
                snapshotObject,
                assetLookup,
                objectCoordinateOrigin
            );
            if (layer) {
                layers.push(layer);
            }
        }

        return layers;
    } finally {
        canvas.dispose();
    }
}

export function canUseMockupPreviewApi(templateDef) {
    return BACKEND_TEMPLATE_ID_PATTERN.test(String(templateDef?.id || '').trim());
}

export async function buildMockupPreviewPayload({
    templateDef,
    surfaceDef,
    surfacePrintAreas,
    snapshots,
    shirtColor,
    shirtColors,
    uploadedImages,
}) {
    const templateId = String(templateDef?.id || '').trim();
    if (!canUseMockupPreviewApi(templateDef)) {
        return null;
    }

    const surfaceKey = surfaceDef?.key;
    const printArea = surfacePrintAreas?.[surfaceKey] || surfaceDef?.printArea;
    if (!surfaceKey || !printArea) {
        return null;
    }

    const images = await serializeSurfaceLayers(
        snapshots?.[surfaceKey] || null,
        surfaceDef,
        printArea,
        uploadedImages
    );

    const payload = {
        templateId,
        colorKey: resolveSelectedColorKey(shirtColor, shirtColors) || undefined,
        surfaceKey,
        responseType: 'json',
        format: DEFAULT_OUTPUT_FORMAT,
        size: DEFAULT_OUTPUT_SIZE,
        print: {
            placeholders: [{
                dom_id: resolveSurfaceDomIds(surfaceKey, surfaceDef),
                position: resolveSurfacePosition(surfaceKey, surfaceDef),
                sequence: Number(surfaceDef?.sequence) || 0,
                printable: surfaceDef?.printable !== false,
                decoration_method: resolveDecorationMethod(surfaceDef),
                images,
            }],
            print_on_side: false,
            mirror: false,
            canvas: false,
            font_color: 'auto',
            country: 'Bangladesh',
        },
        mockup_mode: templateDef?.defaultRenderOptions?.mockupMode || 'RGB',
        new_embroidery_color_palette: true,
    };

    const renderDefaults = templateDef?.defaultRenderOptions || {};
    const passthroughFieldMap = [
        ['decoratorId', 'decorator_id'],
        ['decorator_id', 'decorator_id'],
        ['cameraId', 'camera_id'],
        ['camera_id', 'camera_id'],
        ['variantId', 'variant_id'],
        ['variant_id', 'variant_id'],
        ['blueprintId', 'blueprint_id'],
        ['blueprint_id', 'blueprint_id'],
    ];

    passthroughFieldMap.forEach(([sourceKey, targetKey]) => {
        const value = renderDefaults?.[sourceKey];
        if (value !== undefined && value !== null && value !== '') {
            payload[targetKey] = value;
        }
    });

    return payload;
}

export function buildMockupFilename({
    templateDef,
    surfaceKey,
    format,
    mimeType,
}) {
    const baseName = String(templateDef?.slug || templateDef?.productType || 'product').trim() || 'product';
    const extension = resolveFileExtension({ format, mimeType });
    return `${baseName}-${surfaceKey}-mockup.${extension}`;
}
