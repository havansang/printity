import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../app/router';
import { useAuth } from '../features/auth/AuthContext';
import { useHomeData } from '../features/home/useHomeData';
import { deleteProject } from '../features/home/homeApi';
import { APP_CONFIG } from '../shared/config/appConfig';
import { resolveRenderableAssetUrl } from '../shared/lib/assetUrls';
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

function buildEditorUrl(templateId, projectId) {
    const params = new URLSearchParams();

    if (projectId) {
        params.set('projectId', projectId);
    }

    if (templateId) {
        params.set('templateId', templateId);
    }

    const queryString = params.toString();
    return queryString ? `/editor?${queryString}` : '/editor';
}

function getTemplatePreview(template) {
    if (template?.thumbnailUrl) return resolveRenderableAssetUrl(template.thumbnailUrl);

    const firstSurface = Object.values(template?.surfaces || {})[0];
    return resolveRenderableAssetUrl(firstSurface?.templateImageUrl) || '/front.svg';
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

function ProjectListSkeletonRow() {
    return (
        <div className="dashboard-products-row dashboard-products-row-skeleton">
            <div className="dashboard-products-checkbox-cell">
                <div className="dashboard-products-checkbox-skeleton skeleton-line" />
            </div>
            <div className="dashboard-products-product-cell">
                <div className="dashboard-products-thumb dashboard-products-thumb-skeleton skeleton-box" />
                <div className="dashboard-products-copy">
                    <div className="skeleton-line skeleton-line-title" />
                    <div className="skeleton-line" />
                </div>
            </div>
            <div className="skeleton-line skeleton-line-short" />
            <div className="skeleton-line skeleton-line-short" />
            <div className="skeleton-line skeleton-line-short" />
            <div className="dashboard-products-actions-cell">
                <div className="dashboard-products-icon-skeleton skeleton-line" />
                <div className="dashboard-products-icon-skeleton skeleton-line" />
            </div>
        </div>
    );
}

function formatProjectStatus(status) {
    const normalizedStatus = String(status || 'draft').trim().toLowerCase();

    if (normalizedStatus === 'completed') return 'Completed';
    if (normalizedStatus === 'draft') return 'Draft';
    return normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
}

function sortProjects(items, sortValue) {
    const sortedItems = [...items];

    sortedItems.sort((left, right) => {
        switch (sortValue) {
            case 'updated-asc':
                return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
            case 'created-desc':
                return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
            case 'created-asc':
                return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
            case 'name-asc':
                return String(left.name || '').localeCompare(String(right.name || ''));
            case 'status':
                return String(left.status || '').localeCompare(String(right.status || ''));
            case 'updated-desc':
            default:
                return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
        }
    });

    return sortedItems;
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
                                <span>{template?.supportedSurfaces?.length || Object.keys(template?.surfaces || {}).length} surfaces</span>
                                <span>{template?.availableColors?.length || 0} colors</span>
                            </div>

                            <button
                                type="button"
                                className="primary-action dashboard-card-action"
                                onClick={() => navigate(buildEditorUrl(template.id))}
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

function ProductsView({ projects, projectsLoading, projectsError, refreshProjects, token }) {
    const [searchValue, setSearchValue] = useState('');
    const [sortValue, setSortValue] = useState('updated-desc');
    const [selectedIds, setSelectedIds] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [busyIds, setBusyIds] = useState([]);
    const [actionError, setActionError] = useState('');
    const [actionMessage, setActionMessage] = useState('');
    const selectAllRef = useRef(null);

    const filteredProjects = useMemo(() => {
        const normalizedSearchValue = searchValue.trim().toLowerCase();
        const visibleItems = normalizedSearchValue
            ? projects.filter((project) => (
                String(project?.name || '').toLowerCase().includes(normalizedSearchValue)
                || String(project?.productType || '').toLowerCase().includes(normalizedSearchValue)
                || String(project?.status || '').toLowerCase().includes(normalizedSearchValue)
            ))
            : projects;

        return sortProjects(visibleItems, sortValue);
    }, [projects, searchValue, sortValue]);

    const selectedVisibleCount = useMemo(
        () => filteredProjects.filter((project) => selectedIds.includes(project.id)).length,
        [filteredProjects, selectedIds]
    );
    const allVisibleSelected = filteredProjects.length > 0 && selectedVisibleCount === filteredProjects.length;

    useEffect(() => {
        setSelectedIds((currentValue) => currentValue.filter((id) => projects.some((project) => project.id === id)));
    }, [projects]);

    useEffect(() => {
        if (!selectAllRef.current) return;
        selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected;
    }, [allVisibleSelected, selectedVisibleCount]);

    const toggleProjectSelection = (projectId) => {
        setSelectedIds((currentValue) => (
            currentValue.includes(projectId)
                ? currentValue.filter((id) => id !== projectId)
                : [...currentValue, projectId]
        ));
    };

    const toggleAllVisible = () => {
        const visibleIds = filteredProjects.map((project) => project.id);

        if (allVisibleSelected) {
            setSelectedIds((currentValue) => currentValue.filter((id) => !visibleIds.includes(id)));
            return;
        }

        setSelectedIds((currentValue) => Array.from(new Set([...currentValue, ...visibleIds])));
    };

    const handleDeleteProjects = async (projectIds) => {
        const normalizedIds = Array.from(new Set((Array.isArray(projectIds) ? projectIds : []).filter(Boolean)));
        if (!token || normalizedIds.length === 0 || isDeleting) return;

        const confirmed = window.confirm(
            normalizedIds.length === 1
                ? 'Delete this product draft?'
                : `Delete ${normalizedIds.length} selected product drafts?`
        );
        if (!confirmed) return;

        setIsDeleting(true);
        setBusyIds(normalizedIds);
        setActionError('');
        setActionMessage('');

        try {
            const results = await Promise.allSettled(
                normalizedIds.map((projectId) => deleteProject(token, projectId))
            );
            const succeededIds = normalizedIds.filter((_, index) => results[index]?.status === 'fulfilled');
            const failedCount = normalizedIds.length - succeededIds.length;

            if (succeededIds.length > 0) {
                await refreshProjects();
                setSelectedIds((currentValue) => currentValue.filter((id) => !succeededIds.includes(id)));
                setActionMessage(
                    succeededIds.length === 1
                        ? 'Product deleted successfully.'
                        : `${succeededIds.length} products deleted successfully.`
                );
            }

            if (failedCount > 0) {
                throw new Error(
                    failedCount === 1
                        ? 'One product could not be deleted.'
                        : `${failedCount} products could not be deleted.`
                );
            }
        } catch (error) {
            setActionError(error?.message || 'Unable to delete the selected products.');
        } finally {
            setBusyIds([]);
            setIsDeleting(false);
        }
    };

    return (
        <section className="dashboard-section-card dashboard-products-list-card">
            <div className="dashboard-section-head">
                <div>
                    <p className="section-kicker">My Product</p>
                    <h2>Manage the product drafts already saved in your workspace.</h2>
                </div>

                <div className="dashboard-products-head-actions">
                    <label className="dashboard-products-search" htmlFor="dashboard-products-search">
                        <SearchIcon />
                        <input
                            id="dashboard-products-search"
                            type="search"
                            placeholder="Search products"
                            value={searchValue}
                            onChange={(event) => setSearchValue(event.target.value)}
                        />
                    </label>

                    <select
                        className="dashboard-products-sort"
                        value={sortValue}
                        onChange={(event) => setSortValue(event.target.value)}
                    >
                        <option value="updated-desc">Recently updated</option>
                        <option value="updated-asc">Oldest updated</option>
                        <option value="created-desc">Newest created</option>
                        <option value="created-asc">Oldest created</option>
                        <option value="name-asc">Name A-Z</option>
                        <option value="status">Status</option>
                    </select>

                    <button
                        type="button"
                        className="ghost-action"
                        onClick={() => navigate('/editor')}
                    >
                        Create product
                    </button>
                </div>
            </div>

            {projectsError && (
                <div className="home-inline-note home-inline-note-warn">
                    {projectsError}
                </div>
            )}

            {(actionError || actionMessage || selectedIds.length > 0) && (
                <div className="dashboard-products-bulkbar">
                    <div className="dashboard-products-bulkbar-copy">
                        {selectedIds.length > 0 ? (
                            <strong>{selectedIds.length} selected</strong>
                        ) : (
                            <strong>Workspace updates</strong>
                        )}
                        {actionError && <span className="dashboard-products-error">{actionError}</span>}
                        {!actionError && actionMessage && <span className="dashboard-products-message">{actionMessage}</span>}
                    </div>

                    <div className="dashboard-products-bulkbar-actions">
                        {selectedIds.length > 0 && (
                            <button
                                type="button"
                                className="header-outline-action"
                                onClick={() => setSelectedIds([])}
                                disabled={isDeleting}
                            >
                                Clear selection
                            </button>
                        )}
                        <button
                            type="button"
                            className="dashboard-products-delete-btn"
                            onClick={() => handleDeleteProjects(selectedIds)}
                            disabled={selectedIds.length === 0 || isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete selected'}
                        </button>
                    </div>
                </div>
            )}

            <div className="dashboard-products-table">
                <div className="dashboard-products-table-head">
                    <label className="dashboard-products-select-all">
                        <input
                            ref={selectAllRef}
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleAllVisible}
                            disabled={projectsLoading || filteredProjects.length === 0}
                        />
                        <span>Select all</span>
                    </label>
                    <span>Product</span>
                    <span>Type</span>
                    <span>Updated</span>
                    <span>Status</span>
                    <span className="dashboard-products-actions-head">Actions</span>
                </div>

                <div className="dashboard-products-table-body">
                    {projectsLoading && Array.from({ length: 5 }).map((_, index) => (
                        <ProjectListSkeletonRow key={index} />
                    ))}

                    {!projectsLoading && projects.length === 0 && (
                        <div className="dashboard-empty-state">
                            <h3>No saved products yet.</h3>
                            <p>Your projects will appear here after you save them from the editor.</p>
                        </div>
                    )}

                    {!projectsLoading && projects.length > 0 && filteredProjects.length === 0 && (
                        <div className="dashboard-empty-state">
                            <h3>No products matched that search.</h3>
                            <p>Try another keyword or clear the search field.</p>
                        </div>
                    )}

                    {!projectsLoading && filteredProjects.map((project) => {
                        const thumbnailUrl = resolveRenderableAssetUrl(project.thumbnailUrl);
                        const isBusy = busyIds.includes(project.id);

                        return (
                            <article key={project.id} className="dashboard-products-row">
                                <div className="dashboard-products-checkbox-cell">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(project.id)}
                                        onChange={() => toggleProjectSelection(project.id)}
                                        disabled={isDeleting}
                                        aria-label={`Select ${project.name}`}
                                    />
                                </div>

                                <div className="dashboard-products-product-cell">
                                    <div className="dashboard-products-thumb">
                                        {thumbnailUrl ? (
                                            <img src={thumbnailUrl} alt={project.name} />
                                        ) : (
                                            <span className="dashboard-products-thumb-fallback">
                                                <ProductsIcon />
                                            </span>
                                        )}
                                    </div>

                                    <div className="dashboard-products-copy">
                                        <button
                                            type="button"
                                            className="dashboard-products-name"
                                            onClick={() => navigate(buildEditorUrl(project.templateId, project.id))}
                                        >
                                            {project.name}
                                        </button>
                                        <p>{formatProductType(project.productType)} product draft</p>
                                        <span>Template ID: {project.templateId}</span>
                                    </div>
                                </div>

                                <div className="dashboard-products-meta-cell">
                                    <strong>{formatProductType(project.productType)}</strong>
                                    <span>{project.productType || 'custom'}</span>
                                </div>

                                <div className="dashboard-products-meta-cell">
                                    <strong>{formatDateTime(project.updatedAt)}</strong>
                                    <span>Created {formatDateTime(project.createdAt)}</span>
                                </div>

                                <div className="dashboard-products-status-cell">
                                    <span className={`dashboard-products-status status-${project.status || 'draft'}`}>
                                        {formatProjectStatus(project.status)}
                                    </span>
                                </div>

                                <div className="dashboard-products-actions-cell">
                                    <button
                                        type="button"
                                        className="dashboard-products-icon-btn"
                                        onClick={() => navigate(buildEditorUrl(project.templateId, project.id))}
                                        title="Resume in studio"
                                    >
                                        <EditIcon />
                                    </button>
                                    <button
                                        type="button"
                                        className="dashboard-products-icon-btn danger"
                                        onClick={() => handleDeleteProjects([project.id])}
                                        disabled={isBusy || isDeleting}
                                        title="Delete product"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
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
    const { isAuthenticated, isInitializing, user, logout, token } = useAuth();
    const [productType, setProductType] = useState('all');
    const currentTab = useMemo(() => resolveDashboardTab(search), [search]);
    const {
        templates,
        templatesLoading,
        templatesError,
        projects,
        projectsLoading,
        projectsError,
        refreshProjects,
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
                        refreshProjects={refreshProjects}
                        token={token}
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

function SearchIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M10.5 4a6.5 6.5 0 1 0 4.13 11.52l4.42 4.42 1.41-1.41-4.42-4.42A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
                fill="currentColor"
            />
        </svg>
    );
}

function EditIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="m16.86 3.49 3.65 3.65-9.77 9.78-4.37.72.72-4.37 9.77-9.78Zm-10.3 11.7-.3 1.83 1.83-.3 8.94-8.95-1.53-1.53-8.94 8.95Z"
                fill="currentColor"
            />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v9H7V9Zm4 0h2v9h-2V9Zm4 0h2v9h-2V9ZM6 21a2 2 0 0 1-2-2V8h16v11a2 2 0 0 1-2 2H6Z"
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
