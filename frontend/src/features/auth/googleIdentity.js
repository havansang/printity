const GOOGLE_IDENTITY_SCRIPT_ID = 'printity-google-identity';
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let googleIdentityPromise = null;

export function loadGoogleIdentityScript() {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Google sign-in is only available in the browser.'));
    }

    if (window.google?.accounts?.id) {
        return Promise.resolve(window.google);
    }

    if (!googleIdentityPromise) {
        googleIdentityPromise = new Promise((resolve, reject) => {
            const handleLoad = () => {
                if (window.google?.accounts?.id) {
                    resolve(window.google);
                    return;
                }

                googleIdentityPromise = null;
                reject(new Error('Google sign-in could not be initialized.'));
            };

            const handleError = () => {
                googleIdentityPromise = null;
                reject(new Error('Google sign-in could not be loaded right now.'));
            };

            const existingScript = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
            if (existingScript) {
                existingScript.addEventListener('load', handleLoad, { once: true });
                existingScript.addEventListener('error', handleError, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.id = GOOGLE_IDENTITY_SCRIPT_ID;
            script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
            script.async = true;
            script.defer = true;
            script.addEventListener('load', handleLoad, { once: true });
            script.addEventListener('error', handleError, { once: true });

            document.head.appendChild(script);
        });
    }

    return googleIdentityPromise;
}
