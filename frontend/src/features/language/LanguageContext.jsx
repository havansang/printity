import {
    createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

const LANGUAGE_STORAGE_KEY = 'printity.language';
const DEFAULT_LANGUAGE = 'en';

const LANGUAGE_CONFIG = {
    en: {
        code: 'en',
        locale: 'en-US',
        label: 'English',
    },
    vi: {
        code: 'vi',
        locale: 'vi-VN',
        label: 'Tiếng Việt',
    },
};

const LanguageContext = createContext(null);

function readStoredLanguage() {
    if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

    const storedLanguage = String(window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || '').trim().toLowerCase();
    return LANGUAGE_CONFIG[storedLanguage] ? storedLanguage : DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState(() => readStoredLanguage());

    const setLanguage = useCallback((nextLanguage) => {
        const normalizedLanguage = String(nextLanguage || '').trim().toLowerCase();
        const resolvedLanguage = LANGUAGE_CONFIG[normalizedLanguage] ? normalizedLanguage : DEFAULT_LANGUAGE;
        setLanguageState(resolvedLanguage);
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        }

        if (typeof document !== 'undefined') {
            document.documentElement.lang = language;
        }
    }, [language]);

    const value = useMemo(() => ({
        language,
        setLanguage,
        locale: LANGUAGE_CONFIG[language]?.locale || LANGUAGE_CONFIG[DEFAULT_LANGUAGE].locale,
        languageOptions: Object.values(LANGUAGE_CONFIG),
    }), [language, setLanguage]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const contextValue = useContext(LanguageContext);
    if (!contextValue) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }

    return contextValue;
}

export default LanguageContext;
