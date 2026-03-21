import { useState } from 'react';
import { navigate } from '../app/router';
import { useAuth } from '../features/auth/AuthContext';
import ProjectsPanel from '../features/home/ProjectsPanel';
import TemplateGrid from '../features/home/TemplateGrid';
import { useHomeData } from '../features/home/useHomeData';
import AppFooter from '../shared/ui/AppFooter';

const FEATURE_HIGHLIGHTS = [
    '100% Free to use',
    '1300+ products',
    'Global delivery',
];

const PRICING_POINTS = [
    {
        title: 'Zero upfront cost',
        description: 'Launch without inventory pressure, then scale production only when orders begin to grow.',
    },
    {
        title: 'Healthy margins',
        description: 'Set your own retail price and build stronger margin across T-shirt and Polo collections.',
    },
    {
        title: 'Built to grow',
        description: 'Keep your catalog, customer experience and design workflow aligned as your brand expands.',
    },
];

const WORKFLOW_STEPS = [
    {
        title: 'Choose from the catalog',
        description: 'Start with ready-to-use T-shirt and Polo layouts that keep product setup clean and fast.',
    },
    {
        title: 'Design and iterate',
        description: 'Move into the studio, refine artwork placement and keep each view balanced and print-ready.',
    },
    {
        title: 'Save and reopen projects',
        description: 'Return to saved drafts, polish final details and prepare products for launch with less friction.',
    },
];

const LEARN_ITEMS = [
    {
        title: 'Design playbooks',
        description: 'Simple visual systems for chest logos, oversized back prints and premium apparel drops.',
    },
    {
        title: 'Selling strategy',
        description: 'Bundle T-shirt and Polo variants into one catalog story instead of isolated product pages.',
    },
];

const SERVICE_ITEMS = [
    {
        title: 'Catalog setup',
        description: 'Turn template metadata into clean launch-ready product sections and campaigns.',
    },
    {
        title: 'Brand operations',
        description: 'Keep uploads, product visuals and project workflows organized for your team.',
    },
];

export default function HomePage() {
    const [productType, setProductType] = useState('all');
    const { isAuthenticated, isInitializing, user } = useAuth();
    const {
        templates,
        templatesLoading,
        templatesError,
        projects,
        projectsLoading,
        projectsError,
    } = useHomeData(productType);

    return (
        <div className="page page-home">
            <section className="landing-hero">
                <p className="hero-eyebrow">Print-on-demand for modern apparel brands</p>
                <h1>CREATE AND SELL CUSTOM PRODUCTS</h1>

                <div className="hero-highlight-row">
                    {FEATURE_HIGHLIGHTS.map((item) => (
                        <span key={item} className="hero-highlight-pill">{item}</span>
                    ))}
                </div>

                <div className="hero-cta-stack">
                    <button type="button" className="primary-action hero-primary-action" onClick={() => navigate('/auth?mode=register')}>
                        Get started for free
                    </button>
                    <span className="hero-caption">No credit card required</span>
                </div>

                {isAuthenticated && (
                    <div className="hero-session-banner">
                        <strong>Welcome back, {user?.displayName || user?.email}</strong>
                        <span>Your workspace is ready for new drafts, catalog browsing and product updates.</span>
                    </div>
                )}
            </section>

            <section className="hero-visual-section">
                <article className="product-showcase-card">
                    <div className="product-showcase-copy">
                        <p className="section-kicker">Product mockup</p>
                        <h2>T-shirts and Polos ready for storefront storytelling.</h2>
                        <p>
                            Turn blank garments into premium, brand-ready products with a clean design
                            workflow and polished visual presentation.
                        </p>
                    </div>

                    <div className="product-mockup-stage">
                        <div className="product-mockup-badge">Best-selling apparel</div>
                        <img src="/front.svg" alt="T-shirt mockup with design" className="product-mockup-image" />
                        <div className="product-mockup-card">
                            <strong>Eco cotton essential</strong>
                            <span>Design once, sell globally</span>
                        </div>
                    </div>
                </article>

                <article className="lifestyle-showcase-card">
                    <img src="/lifestyle-seller.svg" alt="Lifestyle scene with person holding a shirt" className="lifestyle-showcase-image" />
                    <div className="lifestyle-showcase-copy">
                        <p className="section-kicker">Lifestyle visual</p>
                        <h2>Sell with visual confidence, not crowded layouts.</h2>
                        <p>
                            Pair clean product mockups with editorial-style lifestyle imagery to make
                            your storefront feel premium from the first fold.
                        </p>
                    </div>
                </article>
            </section>

            <section className="home-section" id="pricing">
                <div className="section-heading">
                    <div>
                        <p className="section-kicker">Pricing</p>
                        <h2>Keep the landing page simple, let margins stay flexible.</h2>
                    </div>
                </div>

                <div className="info-card-grid">
                    {PRICING_POINTS.map((item) => (
                        <article key={item.title} className="info-card">
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="home-section" id="how-it-works">
                <div className="section-heading">
                    <div>
                        <p className="section-kicker">How it works</p>
                        <h2>A straightforward flow from template to saved project.</h2>
                    </div>
                </div>

                <div className="workflow-grid">
                    {WORKFLOW_STEPS.map((step, index) => (
                        <article key={step.title} className="workflow-card">
                            <span className="workflow-index">0{index + 1}</span>
                            <h3>{step.title}</h3>
                            <p>{step.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <TemplateGrid
                productType={productType}
                onProductTypeChange={setProductType}
                templates={templates}
                isLoading={templatesLoading}
                errorMessage={templatesError}
            />

            <ProjectsPanel
                isAuthenticated={isAuthenticated}
                isInitializing={isInitializing}
                projects={projects}
                isLoading={projectsLoading}
                errorMessage={projectsError}
            />

            <section className="home-section" id="learn">
                <div className="section-heading">
                    <div>
                        <p className="section-kicker">Learn</p>
                        <h2>Resources that keep your store clean and conversion-ready.</h2>
                    </div>
                </div>

                <div className="info-card-grid info-card-grid-two">
                    {LEARN_ITEMS.map((item) => (
                        <article key={item.title} className="info-card">
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="home-section" id="services">
                <div className="section-heading">
                    <div>
                        <p className="section-kicker">Services</p>
                        <h2>Clean systems for product teams, not just one-off mockups.</h2>
                    </div>
                </div>

                <div className="info-card-grid info-card-grid-two">
                    {SERVICE_ITEMS.map((item) => (
                        <article key={item.title} className="info-card">
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <AppFooter />
        </div>
    );
}
