import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../app/router';
import AuthForm from '../features/auth/AuthForm';
import ForgotPasswordFlow from '../features/auth/ForgotPasswordFlow';
import { useAuth } from '../features/auth/AuthContext';
import { getInitials } from '../shared/lib/formatters';

function resolveMode(search) {
    const params = new URLSearchParams(search || '');
    const mode = params.get('mode');

    if (mode === 'register' || mode === 'forgot-password') {
        return mode;
    }

    return 'login';
}

function AuthLogo({ centered = false }) {
    return (
        <div className={`auth-brand-row${centered ? ' auth-brand-row-centered' : ''}`}>
            <button type="button" className="auth-brand-button" onClick={() => navigate('/')}>
                Printity
            </button>
        </div>
    );
}

function AuthSessionCard({ user, logout, centered = false }) {
    return (
        <div className={`auth-session-card${centered ? ' auth-session-card-centered' : ''}`}>
            <div className="auth-session-avatar">
                {getInitials(user?.displayName || user?.email)}
            </div>
            <p className="section-kicker">Session active</p>
            <h1>{user?.displayName || 'Signed in user'}</h1>
            <p>{user?.email}</p>
            <div className="auth-session-actions">
                <button type="button" className="primary-action" onClick={() => navigate('/dashboard')}>
                    Go to dashboard
                </button>
                <button type="button" className="ghost-action" onClick={() => logout()}>
                    Log out
                </button>
            </div>
        </div>
    );
}

export default function AuthPage({ search }) {
    const resolvedMode = useMemo(() => resolveMode(search), [search]);
    const [mode, setMode] = useState(resolvedMode);
    const { isAuthenticated, logout, user } = useAuth();

    useEffect(() => {
        setMode(resolvedMode);
    }, [resolvedMode]);

    const handleModeChange = (nextMode) => {
        setMode(nextMode);
        navigate(`/auth?mode=${nextMode}`, { replace: true });
    };

    if (mode === 'register') {
        return (
            <div className="page page-auth page-auth-register">
                <div className="register-page-shell">
                    <section className="register-panel">
                        <AuthLogo centered />

                        <div className="register-panel-body">
                            {!isAuthenticated && (
                                <AuthForm mode={mode} onModeChange={handleModeChange} />
                            )}

                            {isAuthenticated && (
                                <AuthSessionCard user={user} logout={logout} centered />
                            )}
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    if (mode === 'forgot-password') {
        return (
            <div className="page page-auth page-auth-login">
                <div className="login-page-shell">
                    <aside className="login-visual-panel">
                        <img
                            src="/login-studio-scene.svg"
                            alt="Lifestyle product scene"
                            className="login-visual-image"
                        />
                        <div className="login-visual-overlay" />
                        <div className="login-visual-copy">
                            <h1>
                                <span>RESET FAST,</span>
                                <span className="login-highlight">GET BACK</span>
                                <span>TO WORK</span>
                            </h1>
                            <p>
                                Recover access with a short OTP flow that keeps the experience
                                private, fast and easy to trust.
                            </p>
                            <p>
                                Verify your email, confirm the code, then choose a fresh password
                                without leaving the auth experience.
                            </p>
                        </div>
                    </aside>

                    <section className="login-form-panel">
                        <div className="login-form-chrome">
                            <AuthLogo />
                            <button
                                type="button"
                                className="auth-close-btn"
                                onClick={() => navigate('/')}
                                aria-label="Back to home"
                            >
                                <span aria-hidden="true">Ă—</span>
                            </button>
                        </div>

                        <div className="login-form-panel-body">
                            <ForgotPasswordFlow onModeChange={handleModeChange} />
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div className="page page-auth page-auth-login">
            <div className="login-page-shell">
                <aside className="login-visual-panel">
                    <img
                        src="/login-studio-scene.svg"
                        alt="Lifestyle product scene"
                        className="login-visual-image"
                    />
                    <div className="login-visual-overlay" />
                    <div className="login-visual-copy">
                        <h1>
                            <span>SMALL PRODUCT,</span>
                            <span className="login-highlight">BIG PROFIT</span>
                            <span>POTENTIAL</span>
                        </h1>
                        <p>
                            Custom T-shirts and Polos can become year-round profit makers when the
                            presentation feels clean, premium and easy to trust.
                        </p>
                        <p>
                            Design quickly, save drafts and launch apparel products with a smoother
                            storefront experience.
                        </p>
                    </div>
                </aside>

                <section className="login-form-panel">
                    <div className="login-form-chrome">
                        <AuthLogo />
                        <button
                            type="button"
                            className="auth-close-btn"
                            onClick={() => navigate('/')}
                            aria-label="Back to home"
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    </div>

                    <div className="login-form-panel-body">
                        {!isAuthenticated && (
                            <AuthForm mode={mode} onModeChange={handleModeChange} />
                        )}

                        {isAuthenticated && (
                            <AuthSessionCard user={user} logout={logout} />
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
