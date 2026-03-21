import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { navigate } from '../../app/router';
import { APP_CONFIG } from '../config/appConfig';
import { getInitials } from '../lib/formatters';

const NAV_ITEMS = [
    { label: 'Catalog', sectionId: 'catalog' },
    { label: 'Pricing', sectionId: 'pricing' },
    { label: 'How it works', sectionId: 'how-it-works' },
    { label: 'Solutions', sectionId: 'solutions' },
    { label: 'Learn', sectionId: 'learn' },
    { label: 'Services', sectionId: 'services' },
    { label: 'Support', sectionId: 'support' },
];

function scrollToSection(sectionId) {
    const nextTarget = document.getElementById(sectionId);
    if (!nextTarget) return;

    nextTarget.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
}

export default function AppHeader({ currentPath }) {
    const { isAuthenticated, isInitializing, logout, user } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const userLabel = user?.displayName || user?.email || 'Workspace';

    useEffect(() => {
        setIsMenuOpen(false);
    }, [currentPath]);

    const handleNavClick = (sectionId) => {
        if (currentPath !== '/') {
            navigate('/');
            window.setTimeout(() => scrollToSection(sectionId), 90);
            return;
        }

        scrollToSection(sectionId);
    };

    const authActions = useMemo(() => {
        if (isInitializing) {
            return <span className="header-loading-pill">Checking session...</span>;
        }

        if (!isAuthenticated) {
            return (
                <>
                    <button type="button" className="header-outline-action" onClick={() => navigate('/auth?mode=login')}>
                        Log in
                    </button>
                    <button type="button" className="header-primary-action" onClick={() => navigate('/auth?mode=register')}>
                        Sign up
                    </button>
                </>
            );
        }

        return (
            <>
                <div className="header-user-chip">
                    <span className="header-user-avatar">{getInitials(userLabel)}</span>
                    <div>
                        <strong>{userLabel}</strong>
                        <small>Bearer token ready</small>
                    </div>
                </div>
                <button
                    type="button"
                    className="header-outline-action"
                    onClick={() => {
                        logout();
                        navigate('/');
                    }}
                >
                    Log out
                </button>
            </>
        );
    }, [isAuthenticated, isInitializing, logout, userLabel]);

    return (
        <header className="app-header">
            <button type="button" className="brand-lockup" onClick={() => navigate('/')}>
                <span className="brand-mark">P</span>
                <span className="brand-copy">
                    <strong>{APP_CONFIG.projectName}</strong>
                    <small>Custom product platform</small>
                </span>
            </button>

            <nav className="app-nav app-nav-desktop" aria-label="Primary">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.label}
                        type="button"
                        className="app-nav-link"
                        onClick={() => handleNavClick(item.sectionId)}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>

            <div className="app-header-actions app-header-actions-desktop">
                {authActions}
            </div>

            <button
                type="button"
                className={`app-menu-toggle${isMenuOpen ? ' active' : ''}`}
                aria-expanded={isMenuOpen}
                aria-label="Toggle navigation menu"
                onClick={() => setIsMenuOpen((value) => !value)}
            >
                <span />
                <span />
                <span />
            </button>

            <div className={`app-mobile-panel${isMenuOpen ? ' open' : ''}`}>
                <nav className="app-mobile-nav" aria-label="Mobile primary">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            className="app-mobile-link"
                            onClick={() => {
                                handleNavClick(item.sectionId);
                                setIsMenuOpen(false);
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="app-mobile-actions">
                    {authActions}
                </div>
            </div>
        </header>
    );
}
