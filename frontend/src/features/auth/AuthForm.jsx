import { useEffect, useState } from 'react';
import { navigate } from '../../app/router';
import { useAuth } from './AuthContext';

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

function AppleIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-icon-svg auth-icon-svg-apple">
            <path
                fill="currentColor"
                d="M16.85 12.59c.03 3.27 2.87 4.36 2.9 4.37-.02.08-.45 1.53-1.49 3.02-.9 1.29-1.84 2.58-3.31 2.61-1.44.03-1.9-.85-3.54-.85-1.64 0-2.15.82-3.51.88-1.42.05-2.5-1.42-3.4-2.7-1.84-2.64-3.24-7.45-1.36-10.72.93-1.62 2.59-2.64 4.39-2.67 1.37-.03 2.66.92 3.49.92.83 0 2.4-1.14 4.05-.97.69.03 2.62.28 3.86 2.08-.1.06-2.3 1.34-2.28 4.03Zm-2.54-7.26c.76-.91 1.28-2.18 1.14-3.44-1.09.04-2.41.72-3.19 1.63-.7.8-1.31 2.09-1.15 3.32 1.21.09 2.44-.61 3.2-1.51Z"
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

function CheckIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-icon-svg auth-icon-svg-check">
            <path
                d="m6.5 12.5 3.4 3.4 7.6-8.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function SocialButton({ icon, label, onClick }) {
    return (
        <button type="button" className="social-auth-btn" onClick={onClick}>
            <span className="social-auth-icon">{icon}</span>
            <span>{label}</span>
        </button>
    );
}

function VerificationPlaceholder() {
    return (
        <div className="captcha-placeholder" aria-label="Verification placeholder">
            <div className="captcha-placeholder-main">
                <span className="captcha-status-icon">
                    <CheckIcon />
                </span>
                <div className="captcha-copy">
                    <strong>Verification ready</strong>
                    <p>Secure check placeholder</p>
                </div>
            </div>

            <div className="captcha-provider">
                <strong>CLOUDFLARE</strong>
                <small>Placeholder</small>
            </div>
        </div>
    );
}

export default function AuthForm({ mode, onModeChange }) {
    const { login, register } = useAuth();
    const [formState, setFormState] = useState({
        email: '',
        password: '',
        receiveUpdates: true,
    });
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitError, setSubmitError] = useState('');
    const [socialNotice, setSocialNotice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const isRegisterMode = mode === 'register';

    useEffect(() => {
        setFieldErrors({});
        setSubmitError('');
        setSocialNotice('');
        setShowPassword(false);
        setFormState((previous) => ({
            email: previous.email,
            password: '',
            receiveUpdates: previous.receiveUpdates,
        }));
    }, [mode]);

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

    const handleSocialClick = (provider) => {
        if (provider === 'google') {
            setSocialNotice('Google sign-in is ready for hookup as soon as the Google identity client is configured.');
            return;
        }

        setSocialNotice('Apple sign-in is planned in the interface, but the backend flow is not available yet.');
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

        setIsSubmitting(true);
        setFieldErrors({});

        try {
            if (isRegisterMode) {
                await register({
                    email: formState.email.trim(),
                    password: formState.password,
                });
            } else {
                await login({
                    email: formState.email.trim(),
                    password: formState.password,
                });
            }

            navigate('/');
        } catch (error) {
            setFieldErrors(collectApiErrors(error));
            setSubmitError(error?.message || 'Unable to submit this form right now.');
        } finally {
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
                <SocialButton
                    icon={<GoogleIcon />}
                    label="Continue with Google"
                    onClick={() => handleSocialClick('google')}
                />
                <SocialButton
                    icon={<AppleIcon />}
                    label="Continue with Apple"
                    onClick={() => handleSocialClick('apple')}
                />
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

                <VerificationPlaceholder />

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

                <button className="auth-submit" type="submit" disabled={isSubmitting}>
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
                        onClick={() => setSocialNotice('Password reset can be added next when that flow is ready.')}
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
