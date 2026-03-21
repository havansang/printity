export const fallbackTemplates = [
    {
        id: 'fallback-classic-tee',
        name: 'Classic T-shirt',
        slug: 'classic-tee',
        productType: 'tshirt',
        description: 'Balanced front, back and neck-label zones for print-on-demand products.',
        thumbnailUrl: '/front.svg',
        surfaces: {
            front: {
                label: 'Front print',
                templateImageUrl: '/front.svg',
            },
            back: {
                label: 'Back print',
                templateImageUrl: '/back.svg',
            },
            neck: {
                label: 'Neck label inner',
                templateImageUrl: '/Neck_Label_Inner.svg',
            },
        },
    },
    {
        id: 'fallback-polo',
        name: 'Studio Polo',
        slug: 'studio-polo',
        productType: 'polo',
        description: 'A polished product shell ready for API-backed template data.',
        thumbnailUrl: '/back.svg',
        surfaces: {
            front: {
                label: 'Front chest area',
                templateImageUrl: '/front.svg',
            },
            back: {
                label: 'Back print',
                templateImageUrl: '/back.svg',
            },
        },
    },
];
