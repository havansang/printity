const TURNSTILE_SCRIPT_ID = 'printity-turnstile';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let turnstileScriptPromise = null;

export function loadTurnstileScript() {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Turnstile can only load in the browser.'));
    }

    if (window.turnstile) {
        return Promise.resolve(window.turnstile);
    }

    if (!turnstileScriptPromise) {
        turnstileScriptPromise = new Promise((resolve, reject) => {
            const handleLoad = () => {
                if (window.turnstile) {
                    resolve(window.turnstile);
                    return;
                }

                turnstileScriptPromise = null;
                reject(new Error('Cloudflare Turnstile could not be initialized.'));
            };

            const handleError = () => {
                turnstileScriptPromise = null;
                reject(new Error('Cloudflare Turnstile could not be loaded.'));
            };

            const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID);
            if (existingScript) {
                existingScript.addEventListener('load', handleLoad, { once: true });
                existingScript.addEventListener('error', handleError, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.id = TURNSTILE_SCRIPT_ID;
            script.src = TURNSTILE_SCRIPT_SRC;
            script.async = true;
            script.defer = true;
            script.addEventListener('load', handleLoad, { once: true });
            script.addEventListener('error', handleError, { once: true });
            document.head.appendChild(script);
        });
    }

    return turnstileScriptPromise;
}
