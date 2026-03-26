import { useEffect, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { APP_CONFIG } from '../../shared/config/appConfig';
import { useAuth } from './AuthContext';
import { loadGoogleIdentityScript } from './googleIdentity';
import TurnstileField from './TurnstileField';
import { TURNSTILE_ACTIONS } from './turnstileActions';

function validate(mode, formState) {
    const nextErrors = {};

    if (!formState.email.trim()) {
        nextErrors.email = 'Email is required.';
    } else if (!/^\S+@\S+\.\S+$/.test(formState.email.trim())) {
        nextErrors.email = 'Use a valid email address.';
    }

    if (!formState.password) {
        nextErrors.password = 'Password is required.';
    } else if (mode === 'register' && formState.password.length < 8) {
        nextErrors.password = 'Password must be at least 8 characters.';
    }

    return nextErrors;
}

function collectApiErrors(error) {
    if (Array.isArray(error?.errors) && error.errors.length > 0) {
        return Object.fromEntries(
            error.errors
                .filter((item) => item?.field && item?.message)
                .map((item) => [item.field, item.message])
        );
    }

    return {};
}

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-icon-svg">
            <path
                fill="#4285F4"
                d="M21.6 12.23c0-.7-.06-1.22-.19-1.77H12v3.34h5.52c-.11.83-.72 2.09-2.08 2.94l-.02.11 3.02 2.29.21.02c1.92-1.73 2.95-4.28 2.95-6.93Z"
            />
            <path
                fill="#34A853"
                d="M12 22c2.7 0 4.97-.87 6.63-2.37l-3.21-2.43c-.86.59-2.01 1-3.42 1-2.64 0-4.88-1.73-5.68-4.12l-.11.01-3.14 2.38-.04.1C4.68 19.77 8.05 22 12 22Z"
            />
            <path
                fill="#FBBC05"
                d="M6.32 14.08A5.88 5.88 0 0 1 6 12c0-.72.12-1.42.31-2.08l-.01-.14-3.18-2.42-.1.05A9.83 9.83 0 0 0 2 12c0 1.56.37 3.04 1.02 4.41l3.3-2.33Z"
            />
            <path
                fill="#EA4335"
                d="M12 5.8c1.78 0 2.98.75 3.66 1.38l2.67-2.55C16.96 3.38 14.7 2 12 2 8.05 2 4.68 4.23 3.02 7.59l3.29 2.47C7.11 7.52 9.36 5.8 12 5.8Z"
            />
        </svg>
    );
}

function EyeIcon({ open }) {
    if (open) {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-icon-svg auth-icon-svg-stroke">
                <path
                    d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12 18.7 18.5 12 18.5 1.5 12 1.5 12Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle
                    cx="12"
                    cy="12"
                    r="3.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-icon-svg auth-icon-svg-stroke">
            <path
                d="M3 3 21 21"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                d="M10.58 10.58A2 2 0 0 0 13.42 13.42"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                d="M9.9 5.22A10.68 10.68 0 0 1 12 5c6.7 0 10.5 7 10.5 7a18.08 18.08 0 0 1-3.17 3.94"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M6.23 6.23A18.94 18.94 0 0 0 1.5 12S5.3 19 12 19a10.8 10.8 0 0 0 4.23-.84"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function SocialButton({ icon, label, onClick, disabled = false }) {
    return (
        <button type="button" className="social-auth-btn" onClick={onClick} disabled={disabled}>
            <span className="social-auth-icon">{icon}</span>
            <span>{label}</span>
        </button>
    );
}

export default function AuthForm({ mode, onModeChange }) {
    const { login, loginWithGoogle, register } = useAuth();
    const [formState, setFormState] = useState({
        email: '',
        password: '',
        receiveUpdates: true,
    });
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitError, setSubmitError] = useState('');
    const [socialNotice, setSocialNotice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState('');
    const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
    const [googleStatus, setGoogleStatus] = useState(
        APP_CONFIG.googleClientId ? 'loading' : 'unavailable'
    );
    const [showPassword, setShowPassword] = useState(false);
    const googleButtonRef = useRef(null);

    const isRegisterMode = mode === 'register';
    const isGoogleConfigured = Boolean(APP_CONFIG.googleClientId);
    const isTurnstileConfigured = Boolean(APP_CONFIG.turnstileSiteKey);
    const isBusy = isSubmitting || isGoogleSubmitting;

    useEffect(() => {
        setFieldErrors({});
        setSubmitError('');
        setSocialNotice('');
        setIsGoogleSubmitting(false);
        setTurnstileToken('');
        setTurnstileResetSignal((value) => value + 1);
        setShowPassword(false);
        setFormState((previous) => ({
            email: previous.email,
            password: '',
            receiveUpdates: previous.receiveUpdates,
        }));
    }, [mode]);

    useEffect(() => {
        let isCancelled = false;

        if (!isGoogleConfigured) {
            setGoogleStatus('unavailable');
            return undefined;
        }

        setGoogleStatus(window.google?.accounts?.id ? 'ready' : 'loading');

        loadGoogleIdentityScript()
            .then(() => {
                if (!isCancelled) {
                    setGoogleStatus('ready');
                }
            })
            .catch((error) => {
                if (!isCancelled) {
                    setGoogleStatus('error');
                    setSocialNotice(error?.message || 'Google sign-in could not be loaded right now.');
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [isGoogleConfigured]);

    useEffect(() => {
        if (googleStatus !== 'ready' || !isGoogleConfigured || !googleButtonRef.current) {
            return undefined;
        }

        const googleAccounts = window.google?.accounts?.id;
        if (!googleAccounts) {
            return undefined;
        }

        let isCancelled = false;
        const buttonHost = googleButtonRef.current;
        let lastRenderedWidth = 0;

        const renderGoogleButton = () => {
            const nextWidth = Math.max(Math.floor(buttonHost.getBoundingClientRect().width), 240);
            if (nextWidth === lastRenderedWidth && buttonHost.childElementCount > 0) {
                return;
            }

            lastRenderedWidth = nextWidth;
            buttonHost.innerHTML = '';

            googleAccounts.initialize({
                client_id: APP_CONFIG.googleClientId,
                auto_select: false,
                cancel_on_tap_outside: true,
                context: isRegisterMode ? 'signup' : 'signin',
                callback: async (response) => {
                    if (isCancelled) {
                        return;
                    }

                    setSubmitError('');
                    setSocialNotice('');
                    setFieldErrors({});

                    if (!response?.credential) {
                        setSubmitError('Google did not return an ID token. Please try again.');
                        return;
                    }

                    setIsGoogleSubmitting(true);

                    try {
                        await loginWithGoogle({ idToken: response.credential });
                        navigate('/dashboard');
                    } catch (error) {
                        if (isCancelled) {
                            return;
                        }

                        setFieldErrors(collectApiErrors(error));
                        setSubmitError(error?.message || 'Google sign-in failed. Please try again.');
                    } finally {
                        if (!isCancelled) {
                            setIsGoogleSubmitting(false);
                        }
                    }
                },
            });

            googleAccounts.renderButton(buttonHost, {
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                locale: 'en',
                width: nextWidth,
            });
        };

        renderGoogleButton();

        let resizeObserver;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                renderGoogleButton();
            });
            resizeObserver.observe(buttonHost);
        }

        return () => {
            isCancelled = true;
            resizeObserver?.disconnect();
            buttonHost.innerHTML = '';
        };
    }, [googleStatus, isGoogleConfigured, isRegisterMode, loginWithGoogle]);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        setFormState((previous) => ({
            ...previous,
            [name]: type === 'checkbox' ? checked : value,
        }));
        setFieldErrors((previous) => {
            if (!previous[name]) return previous;
            return { ...previous, [name]: '' };
        });
    };

    const handleGoogleClick = () => {
        if (!isGoogleConfigured) {
            setSocialNotice(
                'Google sign-in needs the same Google client ID to be exposed to the frontend.'
            );
            return;
        }

        if (googleStatus === 'loading') {
            setSocialNotice('Google sign-in is still loading. Please wait a moment and try again.');
            return;
        }

        if (googleStatus === 'error') {
            setSocialNotice('Google sign-in could not be loaded. Refresh the page and try again.');
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitError('');
        setSocialNotice('');

        const nextErrors = validate(mode, formState);
        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            return;
        }

        if (!isTurnstileConfigured) {
            setSubmitError('Verification is unavailable right now. Please refresh and try again.');
            return;
        }

        if (!turnstileToken) {
            setSubmitError('Please complete the verification challenge.');
            return;
        }

        setIsSubmitting(true);
        setFieldErrors({});

        try {
            if (isRegisterMode) {
                await register({
                    email: formState.email.trim(),
                    password: formState.password,
                    turnstileToken,
                });
            } else {
                await login({
                    email: formState.email.trim(),
                    password: formState.password,
                    turnstileToken,
                });
            }

            navigate('/dashboard');
        } catch (error) {
            setFieldErrors(collectApiErrors(error));
            setSubmitError(error?.message || 'Unable to submit this form right now.');
        } finally {
            setTurnstileToken('');
            setTurnstileResetSignal((value) => value + 1);
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`auth-form-shell auth-form-shell-${mode}`}>
            <div className={`auth-card-header${isRegisterMode ? ' auth-card-header-register' : ''}`}>
                <h1>{isRegisterMode ? "Let's create your account" : 'WELCOME BACK.'}</h1>

                {isRegisterMode && (
                    <p className="auth-header-copy">
                        Already have an account?
                        <button type="button" className="auth-text-link" onClick={() => onModeChange('login')}>
                            Log in
                        </button>
                    </p>
                )}
            </div>

            <div className="social-auth-group">
                {googleStatus === 'ready' ? (
                    <div className={`google-auth-slot${isBusy ? ' google-auth-slot-disabled' : ''}`}>
                        <div ref={googleButtonRef} className="google-auth-button-host" />
                        {isGoogleSubmitting && (
                            <div className="google-auth-overlay">Signing in with Google...</div>
                        )}
                    </div>
                ) : (
                    <SocialButton
                        icon={<GoogleIcon />}
                        label={googleStatus === 'loading' ? 'Preparing Google...' : 'Continue with Google'}
                        onClick={handleGoogleClick}
                        disabled={isBusy || googleStatus === 'loading'}
                    />
                )}
            </div>

            <div className="auth-divider">
                <span>OR</span>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
                <label className="auth-field">
                    <span>Email</span>
                    <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder=""
                        value={formState.email}
                        onChange={handleChange}
                    />
                    {fieldErrors.email && <small>{fieldErrors.email}</small>}
                </label>

                <label className="auth-field">
                    <span>Password</span>
                    <div className="auth-password-field">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                            placeholder=""
                            value={formState.password}
                            onChange={handleChange}
                        />
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowPassword((value) => !value)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            <EyeIcon open={showPassword} />
                        </button>
                    </div>
                    {fieldErrors.password && <small>{fieldErrors.password}</small>}
                </label>

                <TurnstileField
                    key={`${mode}-${turnstileResetSignal}`}
                    action={isRegisterMode ? TURNSTILE_ACTIONS.register : TURNSTILE_ACTIONS.login}
                    onTokenChange={setTurnstileToken}
                />

                {isRegisterMode && (
                    <label className="auth-checkbox-row">
                        <input
                            type="checkbox"
                            name="receiveUpdates"
                            checked={formState.receiveUpdates}
                            onChange={handleChange}
                        />
                        <span>
                            I want to receive updates and helpful guides via email from Printity.
                            <em>You can unsubscribe at any time.</em>
                        </span>
                    </label>
                )}

                {submitError && <div className="auth-message auth-message-error">{submitError}</div>}
                {socialNotice && <div className="auth-message auth-message-info">{socialNotice}</div>}

                <button className="auth-submit" type="submit" disabled={isBusy}>
                    {isSubmitting
                        ? (isRegisterMode ? 'Creating account...' : 'Signing in...')
                        : (isRegisterMode ? 'Sign up' : 'Sign in')}
                </button>
            </form>

            {!isRegisterMode && (
                <div className="auth-login-secondary-actions">
                    <button
                        type="button"
                        className="auth-inline-link auth-inline-link-center"
                        onClick={() => onModeChange('forgot-password')}
                    >
                        Forgot password?
                    </button>

                    <p className="auth-switch-copy">
                        New to Printity?
                        <button type="button" className="auth-text-link" onClick={() => onModeChange('register')}>
                            Sign Up
                        </button>
                    </p>
                </div>
            )}

            {isRegisterMode && (
                <p className="auth-legal-copy">
                    By clicking Sign up you agree to Printity&apos;s
                    <button
                        type="button"
                        className="auth-text-link"
                        onClick={() => setSocialNotice('Legal policy pages can be wired next.')}
                    >
                        Terms of Service
                    </button>
                    ,
                    <button
                        type="button"
                        className="auth-text-link"
                        onClick={() => setSocialNotice('Legal policy pages can be wired next.')}
                    >
                        Privacy Policy
                    </button>
                    and
                    <button
                        type="button"
                        className="auth-text-link"
                        onClick={() => setSocialNotice('Legal policy pages can be wired next.')}
                    >
                        Intellectual Property Policy
                    </button>
                    .
                </p>
            )}
        </div>
    );
}
