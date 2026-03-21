export function formatDateTime(value) {
    if (!value) return 'Just now';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

export function getInitials(value) {
    const source = String(value || '').trim();
    if (!source) return 'PT';

    const segments = source.split(/\s+/).filter(Boolean);
    if (segments.length === 1) return segments[0].slice(0, 2).toUpperCase();

    return segments
        .slice(0, 2)
        .map((segment) => segment[0])
        .join('')
        .toUpperCase();
}

export function formatProductType(productType) {
    if (!productType) return 'Custom product';
    if (productType === 'tshirt') return 'T-shirt';
    if (productType === 'polo') return 'Polo';
    return String(productType);
}
