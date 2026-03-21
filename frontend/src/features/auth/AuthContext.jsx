import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    getCurrentUser,
    login as loginRequest,
    logout as logoutRequest,
    register as registerRequest,
} from './authApi';

const AUTH_STORAGE_KEY = 'printity.auth.session';
const AuthContext = createContext(null);

function readStoredSession() {
    try {
        const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (!rawValue) return { token: '', user: null };

        const parsed = JSON.parse(rawValue);
        return {
            token: parsed?.token || '',
            user: parsed?.user || null,
        };
    } catch (error) {
        return { token: '', user: null };
    }
}

function writeStoredSession(session) {
    if (!session?.token) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        return;
    }

    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }) {
    const [session, setSession] = useState(() => readStoredSession());
    const [isInitializing, setIsInitializing] = useState(Boolean(readStoredSession().token));

    const persistSession = useCallback((nextSession) => {
        const safeSession = {
            token: nextSession?.token || '',
            user: nextSession?.user || null,
        };

        setSession(safeSession);
        writeStoredSession(safeSession);
    }, []);

    const clearSession = useCallback(() => {
        persistSession({ token: '', user: null });
    }, [persistSession]);

    const refreshCurrentUser = useCallback(async (tokenOverride) => {
        const activeToken = tokenOverride || session.token;
        if (!activeToken) return null;

        const payload = await getCurrentUser(activeToken);
        const nextUser = payload?.data?.user || null;
        persistSession({ token: activeToken, user: nextUser });
        return nextUser;
    }, [persistSession, session.token]);

    useEffect(() => {
        let isCancelled = false;

        if (!session.token) {
            setIsInitializing(false);
            return undefined;
        }

        setIsInitializing(true);
        refreshCurrentUser(session.token)
            .catch(() => {
                if (!isCancelled) clearSession();
            })
            .finally(() => {
                if (!isCancelled) setIsInitializing(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [clearSession, refreshCurrentUser, session.token]);

    const login = useCallback(async (credentials) => {
        const payload = await loginRequest(credentials);
        persistSession({
            token: payload?.data?.token || '',
            user: payload?.data?.user || null,
        });
        return payload;
    }, [persistSession]);

    const register = useCallback(async (credentials) => {
        const payload = await registerRequest(credentials);
        persistSession({
            token: payload?.data?.token || '',
            user: payload?.data?.user || null,
        });
        return payload;
    }, [persistSession]);

    const logout = useCallback(async () => {
        const activeToken = session.token;
        clearSession();

        if (!activeToken) return;

        try {
            await logoutRequest(activeToken);
        } catch (error) {
            // Ignore transport errors after the session is cleared locally.
        }
    }, [clearSession, session.token]);

    const value = useMemo(() => ({
        token: session.token,
        user: session.user,
        isInitializing,
        isAuthenticated: Boolean(session.token),
        login,
        register,
        logout,
        refreshCurrentUser,
    }), [
        isInitializing,
        login,
        logout,
        refreshCurrentUser,
        register,
        session.token,
        session.user,
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider');
    }

    return context;
}
