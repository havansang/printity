import { useEffect, useRef, useState } from 'react';
import { requestPasswordResetOtp, resetPassword, verifyPasswordResetOtp } from './authApi';

const OTP_LENGTH = 6;
const GENERIC_EMAIL_MESSAGE = "If this email exists, we've sent a verification code.";

function validateEmail(email) {
    if (!email.trim()) {
        return 'Email is required.';
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        return 'Use a valid email address.';
    }

    return '';
}

function validatePasswords(password, confirmPassword) {
    if (!password) {
        return 'Password is required.';
    }

    if (password.length < 8) {
        return 'Password must be at least 8 characters.';
    }

    if (!confirmPassword) {
        return 'Please confirm your password.';
    }

    if (password !== confirmPassword) {
        return 'Passwords do not match.';
    }

    return '';
}

function OtpInputGroup({ digits, onChange, onKeyDown, onPaste, refs, disabled }) {
    return (
        <div className="auth-otp-group" onPaste={onPaste}>
            {digits.map((digit, index) => (
                <input
                    key={index}
                    ref={(element) => {
                        refs.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    className="auth-otp-input"
                    maxLength={1}
                    value={digit}
                    onChange={(event) => onChange(index, event.target.value)}
                    onKeyDown={(event) => onKeyDown(index, event)}
                    disabled={disabled}
                    aria-label={`OTP digit ${index + 1}`}
                />
            ))}
        </div>
    );
}

export default function ForgotPasswordFlow({ onModeChange }) {
    const [step, setStep] = useState('request');
    const [email, setEmail] = useState('');
    const [otpDigits, setOtpDigits] = useState(() => Array(OTP_LENGTH).fill(''));
    const [resetToken, setResetToken] = useState('');
    const [passwordState, setPasswordState] = useState({
        password: '',
        confirmPassword: '',
    });
    const [errorMessage, setErrorMessage] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [pendingAction, setPendingAction] = useState('');
    const otpRefs = useRef([]);

    useEffect(() => {
        if (step !== 'verify' || countdown <= 0) {
            return undefined;
        }

        const timerId = window.setInterval(() => {
            setCountdown((value) => {
                if (value <= 1) {
                    window.clearInterval(timerId);
                    return 0;
                }

                return value - 1;
            });
        }, 1000);

        return () => {
            window.clearInterval(timerId);
        };
    }, [countdown, step]);

    useEffect(() => {
        if (step === 'verify') {
            otpRefs.current[0]?.focus();
        }
    }, [step]);

    const otpValue = otpDigits.join('');
    const isSendingOtp = pendingAction === 'send' || pendingAction === 'resend';
    const isVerifyingOtp = pendingAction === 'verify';
    const isResettingPassword = pendingAction === 'reset';

    const handleEmailSubmit = async (event) => {
        event.preventDefault();
        const emailError = validateEmail(email);

        setErrorMessage('');
        setInfoMessage('');

        if (emailError) {
            setErrorMessage(emailError);
            return;
        }

        setPendingAction('send');

        try {
            const payload = await requestPasswordResetOtp({ email: email.trim() });
            setStep('verify');
            setOtpDigits(Array(OTP_LENGTH).fill(''));
            setResetToken('');
            setPasswordState({ password: '', confirmPassword: '' });
            setInfoMessage(GENERIC_EMAIL_MESSAGE);
            setCountdown(payload?.data?.resendAfterSeconds || 30);
        } catch (error) {
            setErrorMessage(error?.message || 'Unable to send OTP right now.');
        } finally {
            setPendingAction('');
        }
    };

    const handleResendOtp = async () => {
        if (countdown > 0 || isSendingOtp) {
            return;
        }

        setErrorMessage('');
        setInfoMessage('');
        setPendingAction('resend');

        try {
            const payload = await requestPasswordResetOtp({ email: email.trim() });
            setOtpDigits(Array(OTP_LENGTH).fill(''));
            setInfoMessage(GENERIC_EMAIL_MESSAGE);
            setCountdown(payload?.data?.resendAfterSeconds || 30);
            otpRefs.current[0]?.focus();
        } catch (error) {
            setErrorMessage(error?.message || 'Unable to resend OTP right now.');
        } finally {
            setPendingAction('');
        }
    };

    const handleOtpDigitChange = (index, rawValue) => {
        const sanitizedValue = rawValue.replace(/\D/g, '');
        if (!sanitizedValue && rawValue) {
            return;
        }

        setOtpDigits((previous) => {
            const nextDigits = [...previous];

            if (sanitizedValue.length > 1) {
                sanitizedValue
                    .slice(0, OTP_LENGTH - index)
                    .split('')
                    .forEach((digit, offset) => {
                        nextDigits[index + offset] = digit;
                    });

                const nextFocusIndex = Math.min(index + sanitizedValue.length, OTP_LENGTH - 1);
                window.requestAnimationFrame(() => {
                    otpRefs.current[nextFocusIndex]?.focus();
                });

                return nextDigits;
            }

            nextDigits[index] = sanitizedValue;

            if (sanitizedValue && index < OTP_LENGTH - 1) {
                window.requestAnimationFrame(() => {
                    otpRefs.current[index + 1]?.focus();
                });
            }

            return nextDigits;
        });
    };

    const handleOtpKeyDown = (index, event) => {
        if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }

        if (event.key === 'ArrowLeft' && index > 0) {
            event.preventDefault();
            otpRefs.current[index - 1]?.focus();
        }

        if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
            event.preventDefault();
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpPaste = (event) => {
        const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!pastedDigits) {
            return;
        }

        event.preventDefault();
        const nextDigits = Array(OTP_LENGTH).fill('');
        pastedDigits.split('').forEach((digit, index) => {
            nextDigits[index] = digit;
        });
        setOtpDigits(nextDigits);

        const nextFocusIndex = Math.min(pastedDigits.length, OTP_LENGTH) - 1;
        window.requestAnimationFrame(() => {
            otpRefs.current[Math.max(nextFocusIndex, 0)]?.focus();
        });
    };

    const handleVerifyOtp = async (event) => {
        event.preventDefault();
        setErrorMessage('');
        setInfoMessage('');

        if (otpValue.length !== OTP_LENGTH) {
            setErrorMessage('Please enter the 6-digit code.');
            return;
        }

        setPendingAction('verify');

        try {
            const payload = await verifyPasswordResetOtp({
                email: email.trim(),
                otp: otpValue,
            });
            setResetToken(payload?.data?.resetToken || '');
            setStep('reset');
            setOtpDigits(Array(OTP_LENGTH).fill(''));
        } catch (error) {
            setErrorMessage(error?.message || 'Unable to verify this code right now.');
        } finally {
            setPendingAction('');
        }
    };

    const handlePasswordChange = (event) => {
        const { name, value } = event.target;
        setPasswordState((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleResetPassword = async (event) => {
        event.preventDefault();
        setErrorMessage('');
        setInfoMessage('');

        const validationError = validatePasswords(
            passwordState.password,
            passwordState.confirmPassword
        );

        if (validationError) {
            setErrorMessage(validationError);
            return;
        }

        setPendingAction('reset');

        try {
            await resetPassword({
                email: email.trim(),
                resetToken,
                password: passwordState.password,
                confirmPassword: passwordState.confirmPassword,
            });
            setStep('success');
            setResetToken('');
            setPasswordState({ password: '', confirmPassword: '' });
        } catch (error) {
            setErrorMessage(error?.message || 'Unable to reset password right now.');
        } finally {
            setPendingAction('');
        }
    };

    const renderRequestStep = () => (
        <>
            <div className="auth-card-header auth-card-header-forgot">
                <p className="section-kicker">Password recovery</p>
                <h1>Forgot your password?</h1>
                <p className="auth-forgot-copy">
                    Enter the email address linked to your account and we&apos;ll send you a 6-digit
                    verification code.
                </p>
            </div>

            <form className="auth-form" onSubmit={handleEmailSubmit}>
                <label className="auth-field">
                    <span>Email</span>
                    <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>

                {errorMessage && <div className="auth-message auth-message-error">{errorMessage}</div>}
                {infoMessage && <div className="auth-message auth-message-info">{infoMessage}</div>}

                <button className="auth-submit" type="submit" disabled={isSendingOtp}>
                    {isSendingOtp ? 'Sending OTP...' : 'Send OTP'}
                </button>
            </form>

            <div className="auth-forgot-footer">
                <button
                    type="button"
                    className="auth-inline-link auth-inline-link-center"
                    onClick={() => onModeChange('login')}
                >
                    Back to login
                </button>
            </div>
        </>
    );

    const renderVerifyStep = () => (
        <>
            <div className="auth-card-header auth-card-header-forgot">
                <p className="section-kicker">Verify OTP</p>
                <h1>Check your inbox</h1>
                <p className="auth-forgot-copy">
                    Enter the 6-digit code sent to <strong>{email}</strong>.
                </p>
            </div>

            <div className="auth-inline-status auth-inline-status-soft">
                <strong>{GENERIC_EMAIL_MESSAGE}</strong>
                <span>The code expires quickly and can only be used once.</span>
            </div>

            <form className="auth-form" onSubmit={handleVerifyOtp}>
                <OtpInputGroup
                    digits={otpDigits}
                    onChange={handleOtpDigitChange}
                    onKeyDown={handleOtpKeyDown}
                    onPaste={handleOtpPaste}
                    refs={otpRefs}
                    disabled={isVerifyingOtp}
                />

                <div className="auth-otp-meta">
                    <button
                        type="button"
                        className="auth-inline-link"
                        onClick={() => setStep('request')}
                        disabled={isVerifyingOtp}
                    >
                        Change email
                    </button>
                    <span>{countdown > 0 ? `Resend in ${countdown}s` : 'You can resend a new code now.'}</span>
                </div>

                {errorMessage && <div className="auth-message auth-message-error">{errorMessage}</div>}
                {infoMessage && <div className="auth-message auth-message-info">{infoMessage}</div>}

                <button className="auth-submit" type="submit" disabled={isVerifyingOtp}>
                    {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
                </button>

                <button
                    type="button"
                    className="auth-secondary-submit"
                    onClick={handleResendOtp}
                    disabled={countdown > 0 || isSendingOtp || isVerifyingOtp}
                >
                    {isSendingOtp ? 'Sending...' : 'Resend code'}
                </button>
            </form>
        </>
    );

    const renderResetStep = () => (
        <>
            <div className="auth-card-header auth-card-header-forgot">
                <p className="section-kicker">Reset password</p>
                <h1>Create a new password</h1>
                <p className="auth-forgot-copy">
                    Choose a new password for <strong>{email}</strong>.
                </p>
            </div>

            <form className="auth-form" onSubmit={handleResetPassword}>
                <label className="auth-field">
                    <span>New password</span>
                    <input
                        type="password"
                        name="password"
                        autoComplete="new-password"
                        value={passwordState.password}
                        onChange={handlePasswordChange}
                    />
                </label>

                <label className="auth-field">
                    <span>Confirm password</span>
                    <input
                        type="password"
                        name="confirmPassword"
                        autoComplete="new-password"
                        value={passwordState.confirmPassword}
                        onChange={handlePasswordChange}
                    />
                </label>

                {errorMessage && <div className="auth-message auth-message-error">{errorMessage}</div>}
                {infoMessage && <div className="auth-message auth-message-info">{infoMessage}</div>}

                <button className="auth-submit" type="submit" disabled={isResettingPassword}>
                    {isResettingPassword ? 'Updating password...' : 'Update password'}
                </button>
            </form>
        </>
    );

    const renderSuccessStep = () => (
        <div className="auth-success-panel">
            <div className="auth-success-badge">Success</div>
            <h1>Password updated successfully</h1>
            <p>
                Your password has been changed and all existing sessions have been signed out.
            </p>
            <button
                type="button"
                className="auth-submit"
                onClick={() => onModeChange('login')}
            >
                Back to login
            </button>
        </div>
    );

    return (
        <div className="auth-form-shell auth-form-shell-forgot">
            {step === 'request' && renderRequestStep()}
            {step === 'verify' && renderVerifyStep()}
            {step === 'reset' && renderResetStep()}
            {step === 'success' && renderSuccessStep()}
        </div>
    );
}
