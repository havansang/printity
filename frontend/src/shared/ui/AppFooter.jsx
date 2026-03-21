export default function AppFooter() {
    return (
        <footer className="app-footer" id="support">
            <div className="app-footer-top">
                <div className="app-footer-brand">
                    <strong>Printity</strong>
                    <p>
                        Design, publish and sell custom T-shirt and Polo products with a cleaner
                        storefront and a polished workspace.
                    </p>
                </div>

                <div className="app-footer-columns">
                    <section>
                        <h3>About</h3>
                        <a href="#catalog">Catalog</a>
                        <a href="#how-it-works">How it works</a>
                        <a href="#solutions">Solutions</a>
                    </section>

                    <section>
                        <h3>Contact</h3>
                        <a href="#support">Support center</a>
                        <a href="#services">Services</a>
                        <a href="#learn">Learn</a>
                    </section>

                    <section>
                        <h3>Terms</h3>
                        <a href="#support">Terms of Service</a>
                        <a href="#support">Privacy Policy</a>
                        <a href="#support">Refund policy</a>
                    </section>
                </div>
            </div>

            <div className="app-footer-bottom">
                <span>Copyright 2026 Printity</span>
                <span>Built for custom apparel teams and modern storefront launches.</span>
            </div>
        </footer>
    );
}
