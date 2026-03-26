const AUTH_SESSION_EXPIRED_EVENT = 'printity:auth-session-expired';

export function dispatchAuthSessionExpired(detail = {}) {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT, { detail }));
}

export function subscribeToAuthSessionExpired(listener) {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const handleEvent = (event) => {
        listener(event?.detail || {});
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleEvent);

    return () => {
        window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleEvent);
    };
}
