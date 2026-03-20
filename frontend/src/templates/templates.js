function formatSurfaceLabel(key) {
    return String(key || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isSurfaceConfig(config) {
    return Boolean(config && typeof config === 'object' && typeof config.svg === 'string');
}

export function getTemplateSurfaces(templateDef) {
    return Object.entries(templateDef || {})
        .filter(([, config]) => isSurfaceConfig(config))
        .map(([key, config]) => ({
            key,
            ...config,
            label: config.label || formatSurfaceLabel(key),
            placeholderId: config.placeholderId || `placeholder_${key}`,
        }));
}

export const templates = {
    tshirt: {
        assetConfig: '/assets/basic-tee-white/config.json',
        front: {
            svg: 'front.svg',
            label: 'Front side',
            placeholderId: 'placeholder_front',
        },
        back: {
            svg: 'back.svg',
            label: 'Back side',
            placeholderId: 'placeholder_back',
        },
        neck: {
            svg: 'Neck_Label_Inner.svg',
            label: 'Neck label inner',
            placeholderId: 'placeholder_necktag',
        },
    },
};
