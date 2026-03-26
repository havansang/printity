import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../app/router';
import { useAuth } from '../features/auth/AuthContext';
import { useHomeData } from '../features/home/useHomeData';
import { APP_CONFIG } from '../shared/config/appConfig';
import { formatDateTime, formatProductType, getInitials } from '../shared/lib/formatters';

const DASHBOARD_TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
    { key: 'products', label: 'My Product', icon: ProductsIcon },
    { key: 'account', label: 'Account', icon: AccountIcon },
];

function resolveDashboardTab(search) {
    const params = new URLSearchParams(search || '');
    const value = params.get('tab');
    return DASHBOARD_TABS.some((item) => item.key === value) ? value : 'dashboard';
}

function buildDashboardUrl(tab) {
    if (!tab || tab === 'dashboard') return '/dashboard';
    return `/dashboard?tab=${encodeURIComponent(tab)}`;
}

function getTemplatePreview(template) {
    if (template?.thumbnailUrl) return template.thumbnailUrl;

    const firstSurface = Object.values(template?.surfaces || {})[0];
    return firstSurface?.templateImageUrl || '/front.svg';
}

function SidebarNavButton({ isActive, label, icon: Icon, onClick }) {
    return (
        <button
            type="button"
            className={`dashboard-sidebar-link${isActive ? ' active' : ''}`}
            onClick={onClick}
        >
            <span className="dashboard-sidebar-link-icon">
                <Icon />
            </span>
            <span>{label}</span>
        </button>
    );
}

function TemplateSkeletonCard() {
    return (
        <article className="dashboard-template-card dashboard-template-card-skeleton">
            <div className="dashboard-template-thumb skeleton-box" />
            <div className="skeleton-line skeleton-line-title" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line-short" />
        </article>
    );
}

function ProjectSkeletonCard() {
    return (
        <article className="dashboard-product-card dashboard-product-card-skeleton">
            <div className="skeleton-line skeleton-line-title" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line-short" />
        </article>
    );
}

function DashboardOverview({
    user,
    productType,
    onProductTypeChange,
    templates,
    templatesLoading,
    templatesError,
    projects,
}) {
    return (
        <>
            <section className="dashboard-hero-card">
                <div className="dashboard-hero-copy">
                    <p className="dashboard-eyebrow">Workspace</p>
                    <h1>Pick a template and move straight into design.</h1>
                    <p>
                        Your studio is ready. Start from a product template, continue a saved idea,
                        or keep your account details close at hand.
                    </p>
                </div>

                <div className="dashboard-metric-grid">
                    <article className="dashboard-metric-card">
                        <span>Templates</span>
                        <strong>{templatesLoading ? '...' : templates.length}</strong>
                        <small>Ready for customization</small>
                    </article>
                    <article className="dashboard-metric-card">
                        <span>My Product</span>
                        <strong>{projects.length}</strong>
                        <small>Saved drafts in workspace</small>
                    </article>
                    <article className="dashboard-metric-card">
                        <span>Account</span>
                        <strong>{user?.email || 'Not available'}</strong>
                        <small>Signed-in email</small>
                    </article>
                </div>
            </section>

            <section className="dashboard-section-card">
                <div className="dashboard-section-head">
                    <div>
                        <p className="section-kicker">Dashboard</p>
                        <h2>Choose a template to start designing.</h2>
                    </div>

                    <div className="template-filter-group" role="tablist" aria-label="Template product type">
                        {['all', 'tshirt', 'polo'].map((type) => (
                            <button
                                key={type}
                                type="button"
                                className={`template-filter${productType === type ? ' active' : ''}`}
                                onClick={() => onProductTypeChange(type)}
                            >
                                {type === 'all' ? 'All products' : formatProductType(type)}
                            </button>
                        ))}
                    </div>
                </div>

                {templatesError && (
                    <div className="home-inline-note">
                        {templatesError}
                    </div>
                )}

                <div className="dashboard-template-grid">
                    {templatesLoading && Array.from({ length: 3 }).map((_, index) => (
                        <TemplateSkeletonCard key={index} />
                    ))}

                    {!templatesLoading && templates.length === 0 && (
                        <div className="dashboard-empty-state">
                            <h3>No templates are available right now.</h3>
                            <p>Try another product filter or come back after the catalog sync finishes.</p>
                        </div>
                    )}

                    {!templatesLoading && templates.map((template) => (
                        <article key={template.id || template.slug} className="dashboard-template-card">
                            <div className="dashboard-template-card-top">
                                <span className="template-type-chip">{formatProductType(template.productType)}</span>
                                <span className="template-slug-chip">{template.slug}</span>
                            </div>

                            <div className="dashboard-template-thumb">
                                <img src={getTemplatePreview(template)} alt={template.name} />
                            </div>

                            <div className="dashboard-template-body">
                                <h3>{template.name}</h3>
                                <p>
                                    {template.description || 'Ready-to-edit product shell for your next design.'}
                                </p>
                            </div>

                            <div className="dashboard-template-meta">
                                <span>{Object.keys(template?.surfaces || {}).length} surfaces</span>
                                <span>{template?.availableColors?.length || 0} colors</span>
                            </div>

                            <button
                                type="button"
                                className="primary-action dashboard-card-action"
                                onClick={() => navigate('/editor')}
                            >
                                Design this template
                            </button>
                        </article>
                    ))}
                </div>
            </section>
        </>
    );
}

function ProductsView({ projects, projectsLoading, projectsError }) {
    return (
        <section className="dashboard-section-card">
            <div className="dashboard-section-head">
                <div>
                    <p className="section-kicker">My Product</p>
                    <h2>Review the projects you have already created.</h2>
                </div>

                <button
                    type="button"
                    className="ghost-action"
                    onClick={() => navigate('/editor')}
                >
                    Open design studio
                </button>
            </div>

            {projectsError && (
                <div className="home-inline-note home-inline-note-warn">
                    {projectsError}
                </div>
            )}

            <div className="dashboard-product-grid">
                {projectsLoading && Array.from({ length: 3 }).map((_, index) => (
                    <ProjectSkeletonCard key={index} />
                ))}

                {!projectsLoading && projects.length === 0 && (
                    <div className="dashboard-empty-state">
                        <h3>No saved products yet.</h3>
                        <p>Your projects will appear here after you save them from the editor.</p>
                    </div>
                )}

                {!projectsLoading && projects.map((project) => (
                    <article key={project.id} className="dashboard-product-card">
                        <div className="dashboard-product-card-top">
                            <span className={`project-status status-${project.status || 'draft'}`}>
                                {project.status || 'draft'}
                            </span>
                            <span className="project-type">{formatProductType(project.productType)}</span>
                        </div>

                        <h3>{project.name}</h3>
                        <p>Template ID: {project.templateId}</p>
                        <time dateTime={project.updatedAt}>
                            Updated {formatDateTime(project.updatedAt)}
                        </time>

                        <button
                            type="button"
                            className="ghost-action ghost-action-inline"
                            onClick={() => navigate('/editor')}
                        >
                            Resume in studio
                        </button>
                    </article>
                ))}
            </div>
        </section>
    );
}

function AccountView({ user, onLogout }) {
    return (
        <section className="dashboard-section-card">
            <div className="dashboard-section-head">
                <div>
                    <p className="section-kicker">Account</p>
                    <h2>Keep your workspace identity simple and visible.</h2>
                </div>
            </div>

            <div className="dashboard-account-panel">
                <div className="dashboard-account-hero">
                    <div className="dashboard-account-avatar">
                        {getInitials(user?.displayName || user?.email)}
                    </div>

                    <div className="dashboard-account-copy">
                        <h3>{user?.displayName || 'Workspace user'}</h3>
                        <p>{user?.email || 'No email available'}</p>
                    </div>
                </div>

                <div className="dashboard-account-details">
                    <div className="dashboard-detail-row">
                        <span>Email</span>
                        <strong>{user?.email || 'No email available'}</strong>
                    </div>
                    <div className="dashboard-detail-row">
                        <span>Status</span>
                        <strong>Authenticated</strong>
                    </div>
                </div>

                <div className="dashboard-account-actions">
                    <button
                        type="button"
                        className="primary-action"
                        onClick={() => navigate('/editor')}
                    >
                        Open studio
                    </button>
                    <button
                        type="button"
                        className="header-outline-action"
                        onClick={onLogout}
                    >
                        Log out
                    </button>
                </div>
            </div>
        </section>
    );
}

export default function DashboardPage({ search }) {
    const { isAuthenticated, isInitializing, user, logout } = useAuth();
    const [productType, setProductType] = useState('all');
    const currentTab = useMemo(() => resolveDashboardTab(search), [search]);
    const {
        templates,
        templatesLoading,
        templatesError,
        projects,
        projectsLoading,
        projectsError,
    } = useHomeData(productType);

    useEffect(() => {
        if (!isInitializing && !isAuthenticated) {
            navigate('/auth?mode=login', { replace: true });
        }
    }, [isAuthenticated, isInitializing]);

    if (isInitializing || !isAuthenticated) {
        return (
            <div className="route-fallback">
                <div className="route-fallback-dot" />
                <span>Preparing your workspace...</span>
            </div>
        );
    }

    const activeTabMeta = DASHBOARD_TABS.find((item) => item.key === currentTab) || DASHBOARD_TABS[0];
    const userLabel = user?.displayName || user?.email || APP_CONFIG.projectName;

    const handleLogout = async () => {
        await logout();
        navigate('/', { replace: true });
    };

    return (
        <div className="dashboard-shell">
            <aside className="dashboard-sidebar">
                <button type="button" className="dashboard-brand" onClick={() => navigate('/dashboard')}>
                    <span className="dashboard-brand-mark">P</span>
                    <div className="dashboard-brand-copy">
                        <strong>{APP_CONFIG.projectName}</strong>
                        <small>Creator workspace</small>
                    </div>
                </button>

                <nav className="dashboard-sidebar-nav" aria-label="Workspace sections">
                    {DASHBOARD_TABS.map((item) => (
                        <SidebarNavButton
                            key={item.key}
                            isActive={item.key === currentTab}
                            label={item.label}
                            icon={item.icon}
                            onClick={() => navigate(buildDashboardUrl(item.key))}
                        />
                    ))}
                </nav>

                <button
                    type="button"
                    className={`dashboard-account-summary${currentTab === 'account' ? ' active' : ''}`}
                    onClick={() => navigate(buildDashboardUrl('account'))}
                >
                    <span className="dashboard-account-summary-avatar">
                        {getInitials(userLabel)}
                    </span>
                    <span className="dashboard-account-summary-copy">
                        <strong>Account</strong>
                        <small>{user?.email || 'No email available'}</small>
                    </span>
                </button>
            </aside>

            <main className="dashboard-main">
                <div className="dashboard-main-head">
                    <div>
                        <p className="dashboard-eyebrow">Signed in</p>
                        <h1>{activeTabMeta.label}</h1>
                        <p className="dashboard-main-subtitle">
                            {currentTab === 'dashboard' && 'Browse templates and start a new design flow.'}
                            {currentTab === 'products' && 'Check the projects you already created and continue working on them.'}
                            {currentTab === 'account' && 'See the email currently connected to this workspace.'}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="primary-action"
                        onClick={() => navigate('/editor')}
                    >
                        Open design studio
                    </button>
                </div>

                {currentTab === 'dashboard' && (
                    <DashboardOverview
                        user={user}
                        productType={productType}
                        onProductTypeChange={setProductType}
                        templates={templates}
                        templatesLoading={templatesLoading}
                        templatesError={templatesError}
                        projects={projects}
                    />
                )}

                {currentTab === 'products' && (
                    <ProductsView
                        projects={projects}
                        projectsLoading={projectsLoading}
                        projectsError={projectsError}
                    />
                )}

                {currentTab === 'account' && (
                    <AccountView user={user} onLogout={handleLogout} />
                )}
            </main>
        </div>
    );
}

function DashboardIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" fill="currentColor" />
        </svg>
    );
}

function ProductsIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M6 5h12l1 3v10H5V8l1-3Zm2.2 2L8 8h8l-.2-1H8.2ZM9 11h6v2H9v-2Z"
                fill="currentColor"
            />
        </svg>
    );
}

function AccountIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.02-8 4.5V20h16v-1.5c0-2.48-3.58-4.5-8-4.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
