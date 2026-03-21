const ROUTE_EVENT = 'printity:route-change';

export function normalizePath(pathname = '/') {
    if (!pathname || pathname === '/') return '/';
    const normalized = pathname.replace(/\/+$/, '');
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function readRoute() {
    return {
        pathname: normalizePath(window.location.pathname),
        search: window.location.search || '',
    };
}

export function navigate(to, { replace = false } = {}) {
    const url = new URL(to, window.location.origin);
    const nextPath = `${normalizePath(url.pathname)}${url.search}`;
    const currentPath = `${normalizePath(window.location.pathname)}${window.location.search || ''}`;

    if (nextPath === currentPath) return;

    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', nextPath);
    window.dispatchEvent(new Event(ROUTE_EVENT));
    window.scrollTo({ top: 0, behavior: 'auto' });
}

export function subscribeToRouteChanges(listener) {
    const handleChange = () => listener(readRoute());

    window.addEventListener('popstate', handleChange);
    window.addEventListener(ROUTE_EVENT, handleChange);

    return () => {
        window.removeEventListener('popstate', handleChange);
        window.removeEventListener(ROUTE_EVENT, handleChange);
    };
}
