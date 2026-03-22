import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../../shared/config/appConfig';
import { loadTurnstileScript } from './turnstile';

export default function TurnstileField({ action, onTokenChange }) {
    const containerRef = useRef(null);
    const widgetIdRef = useRef(null);
    const [errorMessage, setErrorMessage] = useState('');
    const siteKey = APP_CONFIG.turnstileSiteKey;

    useEffect(() => {
        onTokenChange('');
    }, [action, onTokenChange]);

    useEffect(() => {
        let isCancelled = false;
        const containerElement = containerRef.current;

        if (!siteKey || !containerElement) {
            return undefined;
        }

        loadTurnstileScript()
            .then((turnstile) => {
                if (isCancelled) {
                    return;
                }

                containerElement.innerHTML = '';
                widgetIdRef.current = turnstile.render(containerElement, {
                    sitekey: siteKey,
                    action,
                    theme: 'light',
                    size: 'flexible',
                    callback: (token) => {
                        if (!isCancelled) {
                            setErrorMessage('');
                            onTokenChange(token);
                        }
                    },
                    'expired-callback': () => {
                        if (!isCancelled) {
                            onTokenChange('');
                            setErrorMessage('Verification expired. Please complete the challenge again.');
                        }
                    },
                    'error-callback': () => {
                        if (!isCancelled) {
                            onTokenChange('');
                            setErrorMessage('Verification could not be loaded. Please refresh and try again.');
                        }
                    },
                });
            })
            .catch((error) => {
                if (!isCancelled) {
                    onTokenChange('');
                    setErrorMessage(error?.message || 'Unable to load the verification challenge.');
                }
            });

        return () => {
            isCancelled = true;
            onTokenChange('');

            if (window.turnstile && widgetIdRef.current !== null) {
                window.turnstile.remove?.(widgetIdRef.current);
                widgetIdRef.current = null;
            }

            containerElement.innerHTML = '';
        };
    }, [action, onTokenChange, siteKey]);

    if (!siteKey) {
        return (
            <div className="turnstile-field">
                <div className="auth-message auth-message-error">
                    Cloudflare Turnstile is not configured for this environment.
                </div>
            </div>
        );
    }

    return (
        <div className="turnstile-field">
            <div ref={containerRef} className="turnstile-widget" />
            {errorMessage && <div className="auth-message auth-message-error">{errorMessage}</div>}
        </div>
    );
}
