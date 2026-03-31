function resolveLocale(language = 'en') {
    if (language === 'vi') return 'vi-VN';
    return 'en-US';
}

export function formatDateTime(value, language = 'en') {
    if (!value) return 'Just now';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';

    return new Intl.DateTimeFormat(resolveLocale(language), {
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

export function formatProductType(productType, language = 'en') {
    if (!productType) return language === 'vi' ? 'Sản phẩm tuỳ chỉnh' : 'Custom product';
    if (productType === 'tshirt') return language === 'vi' ? 'Áo thun' : 'T-shirt';
    if (productType === 'polo') return language === 'vi' ? 'Áo polo' : 'Polo';
    return String(productType);
}
