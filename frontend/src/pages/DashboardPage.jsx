import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../app/router';
import { useAuth } from '../features/auth/AuthContext';
import { useHomeData } from '../features/home/useHomeData';
import { deleteProject } from '../features/home/homeApi';
import { useLanguage } from '../features/language/LanguageContext';
import { APP_CONFIG } from '../shared/config/appConfig';
import { resolveRenderableAssetUrl } from '../shared/lib/assetUrls';
import { formatDateTime, formatProductType, getInitials } from '../shared/lib/formatters';

const DASHBOARD_TABS = [
    { key: 'dashboard', labelKey: 'dashboard', icon: DashboardIcon },
    { key: 'products', labelKey: 'products', icon: ProductsIcon },
    { key: 'account', labelKey: 'account', icon: AccountIcon },
];

const DASHBOARD_COPY = {
    en: {
        tabs: {
            dashboard: 'Dashboard',
            products: 'My Product',
            account: 'Account',
            language: 'Language',
        },
        languages: {
            current: 'Current',
            en: 'English',
            vi: 'Tiếng Việt',
        },
        loadingWorkspace: 'Preparing your workspace...',
        signedIn: 'Signed in',
        openDesignStudio: 'Open design studio',
        dashboardSubtitles: {
            dashboard: 'Browse templates and start a new design flow.',
            products: 'Check the projects you already created and continue working on them.',
            account: 'See the email currently connected to this workspace.',
        },
        overview: {
            heroEyebrow: 'Workspace',
            heroTitle: 'Pick a template and move straight into design.',
            heroDescription: 'Your studio is ready. Start from a product template, continue a saved idea, or keep your account details close at hand.',
            metrics: {
                templates: 'Templates',
                templatesSub: 'Ready for customization',
                products: 'My Product',
                productsSub: 'Saved drafts in workspace',
                account: 'Account',
                accountSub: 'Signed-in email',
            },
            sectionKicker: 'Dashboard',
            sectionTitle: 'Choose a template to start designing.',
            templateFilterAria: 'Template product type',
            allProducts: 'All products',
            noTemplatesTitle: 'No templates are available right now.',
            noTemplatesDescription: 'Try another product filter or come back after the catalog sync finishes.',
            fallbackTemplateDescription: 'Ready-to-edit product shell for your next design.',
            surfacesLabel: 'surfaces',
            colorsLabel: 'colors',
            designButton: 'Design this template',
            notAvailable: 'Not available',
        },
        productsView: {
            sectionKicker: 'My Product',
            title: 'Manage the product drafts already saved in your workspace.',
            searchPlaceholder: 'Search products',
            createProduct: 'Create product',
            workspaceUpdates: 'Workspace updates',
            selectedLabel: 'selected',
            clearSelection: 'Clear selection',
            deleteSelected: 'Delete selected',
            deleting: 'Deleting...',
            selectAll: 'Select all',
            columns: {
                product: 'Product',
                type: 'Type',
                updated: 'Updated',
                status: 'Status',
                actions: 'Actions',
            },
            sortOptions: {
                updatedDesc: 'Recently updated',
                updatedAsc: 'Oldest updated',
                createdDesc: 'Newest created',
                createdAsc: 'Oldest created',
                nameAsc: 'Name A-Z',
                status: 'Status',
            },
            noProjectsTitle: 'No saved products yet.',
            noProjectsDescription: 'Your projects will appear here after you save them from the editor.',
            noSearchTitle: 'No products matched that search.',
            noSearchDescription: 'Try another keyword or clear the search field.',
            productDraftSuffix: 'product draft',
            templateIdLabel: 'Template ID',
            createdLabel: 'Created',
            resumeInStudio: 'Resume in studio',
            deleteProduct: 'Delete product',
            deleteConfirmSingle: 'Delete this product draft?',
            deleteConfirmMultiple: 'Delete {count} selected product drafts?',
            deletedSingle: 'Product deleted successfully.',
            deletedMultiple: '{count} products deleted successfully.',
            deleteFailedSingle: 'One product could not be deleted.',
            deleteFailedMultiple: '{count} products could not be deleted.',
            deleteFallbackError: 'Unable to delete the selected products.',
            statusLabels: {
                draft: 'Draft',
                completed: 'Completed',
            },
        },
        accountView: {
            sectionKicker: 'Account',
            title: 'Keep your workspace identity simple and visible.',
            fallbackName: 'Workspace user',
            noEmail: 'No email available',
            emailLabel: 'Email',
            statusLabel: 'Status',
            authenticated: 'Authenticated',
            openStudio: 'Open studio',
            logout: 'Log out',
        },
    },
    vi: {
        tabs: {
            dashboard: 'Bảng điều khiển',
            products: 'Sản phẩm của tôi',
            account: 'Tài khoản',
            language: 'Ngôn ngữ',
        },
        languages: {
            current: 'Đang dùng',
            en: 'English',
            vi: 'Tiếng Việt',
        },
        loadingWorkspace: 'Đang chuẩn bị không gian làm việc...',
        signedIn: 'Đã đăng nhập',
        openDesignStudio: 'Mở trình thiết kế',
        dashboardSubtitles: {
            dashboard: 'Xem template và bắt đầu một luồng thiết kế mới.',
            products: 'Kiểm tra các dự án bạn đã tạo và tiếp tục chỉnh sửa.',
            account: 'Xem email hiện đang kết nối với workspace này.',
        },
        overview: {
            heroEyebrow: 'Workspace',
            heroTitle: 'Chọn template và đi thẳng vào thiết kế.',
            heroDescription: 'Studio của bạn đã sẵn sàng. Hãy bắt đầu từ một template sản phẩm, tiếp tục bản nháp đã lưu hoặc xem nhanh thông tin tài khoản.',
            metrics: {
                templates: 'Template',
                templatesSub: 'Sẵn sàng để tuỳ chỉnh',
                products: 'Sản phẩm',
                productsSub: 'Bản nháp đã lưu trong workspace',
                account: 'Tài khoản',
                accountSub: 'Email đang đăng nhập',
            },
            sectionKicker: 'Bảng điều khiển',
            sectionTitle: 'Chọn template để bắt đầu thiết kế.',
            templateFilterAria: 'Loại sản phẩm template',
            allProducts: 'Tất cả sản phẩm',
            noTemplatesTitle: 'Hiện chưa có template khả dụng.',
            noTemplatesDescription: 'Hãy thử bộ lọc sản phẩm khác hoặc quay lại sau khi quá trình đồng bộ catalog hoàn tất.',
            fallbackTemplateDescription: 'Khung sản phẩm sẵn sàng chỉnh sửa cho thiết kế tiếp theo của bạn.',
            surfacesLabel: 'bề mặt',
            colorsLabel: 'màu',
            designButton: 'Thiết kế template này',
            notAvailable: 'Chưa có',
        },
        productsView: {
            sectionKicker: 'Sản phẩm của tôi',
            title: 'Quản lý các bản nháp sản phẩm đã lưu trong workspace của bạn.',
            searchPlaceholder: 'Tìm kiếm sản phẩm',
            createProduct: 'Tạo sản phẩm',
            workspaceUpdates: 'Cập nhật workspace',
            selectedLabel: 'đã chọn',
            clearSelection: 'Bỏ chọn',
            deleteSelected: 'Xóa mục đã chọn',
            deleting: 'Đang xóa...',
            selectAll: 'Chọn tất cả',
            columns: {
                product: 'Sản phẩm',
                type: 'Loại',
                updated: 'Cập nhật',
                status: 'Trạng thái',
                actions: 'Thao tác',
            },
            sortOptions: {
                updatedDesc: 'Cập nhật gần đây',
                updatedAsc: 'Cập nhật cũ nhất',
                createdDesc: 'Tạo mới nhất',
                createdAsc: 'Tạo cũ nhất',
                nameAsc: 'Tên A-Z',
                status: 'Trạng thái',
            },
            noProjectsTitle: 'Chưa có sản phẩm nào được lưu.',
            noProjectsDescription: 'Dự án của bạn sẽ xuất hiện ở đây sau khi được lưu từ editor.',
            noSearchTitle: 'Không có sản phẩm nào khớp với từ khóa tìm kiếm.',
            noSearchDescription: 'Hãy thử từ khóa khác hoặc xóa ô tìm kiếm.',
            productDraftSuffix: 'bản nháp sản phẩm',
            templateIdLabel: 'Mã template',
            createdLabel: 'Tạo lúc',
            resumeInStudio: 'Mở lại trong studio',
            deleteProduct: 'Xóa sản phẩm',
            deleteConfirmSingle: 'Xóa bản nháp sản phẩm này?',
            deleteConfirmMultiple: 'Xóa {count} bản nháp sản phẩm đã chọn?',
            deletedSingle: 'Đã xóa sản phẩm thành công.',
            deletedMultiple: 'Đã xóa thành công {count} sản phẩm.',
            deleteFailedSingle: 'Có một sản phẩm không thể xóa.',
            deleteFailedMultiple: 'Có {count} sản phẩm không thể xóa.',
            deleteFallbackError: 'Không thể xóa các sản phẩm đã chọn.',
            statusLabels: {
                draft: 'Bản nháp',
                completed: 'Hoàn tất',
            },
        },
        accountView: {
            sectionKicker: 'Tài khoản',
            title: 'Giữ thông tin workspace của bạn rõ ràng và dễ nhìn.',
            fallbackName: 'Người dùng workspace',
            noEmail: 'Chưa có email',
            emailLabel: 'Email',
            statusLabel: 'Trạng thái',
            authenticated: 'Đã xác thực',
            openStudio: 'Mở studio',
            logout: 'Đăng xuất',
        },
    },
};

function interpolateLabel(template, values = {}) {
    return Object.entries(values).reduce(
        (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
        String(template || '')
    );
}

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

function LanguageSidebarControl({
    language,
    setLanguage,
    languageOptions,
    labels,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (!dropdownRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    const activeOption = languageOptions.find((item) => item.code === language) || languageOptions[0];

    return (
        <div ref={dropdownRef} className={`dashboard-language-switcher${isOpen ? ' open' : ''}`}>
            <button
                type="button"
                className={`dashboard-sidebar-link dashboard-language-trigger${isOpen ? ' active' : ''}`}
                onClick={() => setIsOpen((currentValue) => !currentValue)}
            >
                <span className="dashboard-sidebar-link-icon">
                    <LanguageIcon />
                </span>
                <span className="dashboard-language-trigger-copy">
                    <span>{labels.tabs.language}</span>
                    <small>{activeOption?.label || labels.languages.en}</small>
                </span>
                <span className={`dashboard-language-chevron${isOpen ? ' open' : ''}`}>
                    <ChevronDownIcon />
                </span>
            </button>

            {isOpen && (
                <div className="dashboard-language-menu">
                    {languageOptions.map((option) => {
                        const isActive = option.code === language;

                        return (
                            <button
                                key={option.code}
                                type="button"
                                className={`dashboard-language-option${isActive ? ' active' : ''}`}
                                onClick={() => {
                                    setLanguage(option.code);
                                    setIsOpen(false);
                                }}
                            >
                                <span className="dashboard-language-option-copy">
                                    <strong>{labels.languages[option.code] || option.label}</strong>
                                    <small>
                                        {isActive ? labels.languages.current : option.locale}
                                    </small>
                                </span>
                                {isActive && (
                                    <span className="dashboard-language-check">
                                        <CheckIcon />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
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

function formatProjectStatus(status, labels) {
    const normalizedStatus = String(status || 'draft').trim().toLowerCase();

    if (normalizedStatus === 'completed') return labels?.completed || 'Completed';
    if (normalizedStatus === 'draft') return labels?.draft || 'Draft';
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
    language,
    copy,
}) {
    const overviewCopy = copy.overview;

    return (
        <>
            <section className="dashboard-hero-card">
                <div className="dashboard-hero-copy">
                    <p className="dashboard-eyebrow">{overviewCopy.heroEyebrow}</p>
                    <h1>{overviewCopy.heroTitle}</h1>
                    <p>{overviewCopy.heroDescription}</p>
                </div>

                <div className="dashboard-metric-grid">
                    <article className="dashboard-metric-card">
                        <span>{overviewCopy.metrics.templates}</span>
                        <strong>{templatesLoading ? '...' : templates.length}</strong>
                        <small>{overviewCopy.metrics.templatesSub}</small>
                    </article>
                    <article className="dashboard-metric-card">
                        <span>{overviewCopy.metrics.products}</span>
                        <strong>{projects.length}</strong>
                        <small>{overviewCopy.metrics.productsSub}</small>
                    </article>
                    <article className="dashboard-metric-card">
                        <span>{overviewCopy.metrics.account}</span>
                        <strong>{user?.email || overviewCopy.notAvailable}</strong>
                        <small>{overviewCopy.metrics.accountSub}</small>
                    </article>
                </div>
            </section>

            <section className="dashboard-section-card">
                <div className="dashboard-section-head">
                    <div>
                        <p className="section-kicker">{overviewCopy.sectionKicker}</p>
                        <h2>{overviewCopy.sectionTitle}</h2>
                    </div>

                    <div className="template-filter-group" role="tablist" aria-label={overviewCopy.templateFilterAria}>
                        {['all', 'tshirt', 'polo'].map((type) => (
                            <button
                                key={type}
                                type="button"
                                className={`template-filter${productType === type ? ' active' : ''}`}
                                onClick={() => onProductTypeChange(type)}
                            >
                                {type === 'all' ? overviewCopy.allProducts : formatProductType(type, language)}
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
                            <h3>{overviewCopy.noTemplatesTitle}</h3>
                            <p>{overviewCopy.noTemplatesDescription}</p>
                        </div>
                    )}

                    {!templatesLoading && templates.map((template) => (
                        <article key={template.id || template.slug} className="dashboard-template-card">
                            <div className="dashboard-template-card-top">
                                <span className="template-type-chip">{formatProductType(template.productType, language)}</span>
                                <span className="template-slug-chip">{template.slug}</span>
                            </div>

                            <div className="dashboard-template-thumb">
                                <img src={getTemplatePreview(template)} alt={template.name} />
                            </div>

                            <div className="dashboard-template-body">
                                <h3>{template.name}</h3>
                                <p>
                                    {template.description || overviewCopy.fallbackTemplateDescription}
                                </p>
                            </div>

                            <div className="dashboard-template-meta">
                                <span>{template?.supportedSurfaces?.length || Object.keys(template?.surfaces || {}).length} {overviewCopy.surfacesLabel}</span>
                                <span>{template?.availableColors?.length || 0} {overviewCopy.colorsLabel}</span>
                            </div>

                            <button
                                type="button"
                                className="primary-action dashboard-card-action"
                                onClick={() => navigate(buildEditorUrl(template.id))}
                            >
                                {overviewCopy.designButton}
                            </button>
                        </article>
                    ))}
                </div>
            </section>
        </>
    );
}

function ProductsView({
    projects,
    projectsLoading,
    projectsError,
    refreshProjects,
    token,
    language,
    copy,
}) {
    const [searchValue, setSearchValue] = useState('');
    const [sortValue, setSortValue] = useState('updated-desc');
    const [selectedIds, setSelectedIds] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [busyIds, setBusyIds] = useState([]);
    const [actionError, setActionError] = useState('');
    const [actionMessage, setActionMessage] = useState('');
    const selectAllRef = useRef(null);
    const productsCopy = copy.productsView;

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
                ? productsCopy.deleteConfirmSingle
                : interpolateLabel(productsCopy.deleteConfirmMultiple, { count: normalizedIds.length })
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
                        ? productsCopy.deletedSingle
                        : interpolateLabel(productsCopy.deletedMultiple, { count: succeededIds.length })
                );
            }

            if (failedCount > 0) {
                throw new Error(
                    failedCount === 1
                        ? productsCopy.deleteFailedSingle
                        : interpolateLabel(productsCopy.deleteFailedMultiple, { count: failedCount })
                );
            }
        } catch (error) {
            setActionError(error?.message || productsCopy.deleteFallbackError);
        } finally {
            setBusyIds([]);
            setIsDeleting(false);
        }
    };

    return (
        <section className="dashboard-section-card dashboard-products-list-card">
            <div className="dashboard-section-head">
                <div>
                    <p className="section-kicker">{productsCopy.sectionKicker}</p>
                    <h2>{productsCopy.title}</h2>
                </div>

                <div className="dashboard-products-head-actions">
                    <label className="dashboard-products-search" htmlFor="dashboard-products-search">
                        <SearchIcon />
                        <input
                            id="dashboard-products-search"
                            type="search"
                            placeholder={productsCopy.searchPlaceholder}
                            value={searchValue}
                            onChange={(event) => setSearchValue(event.target.value)}
                        />
                    </label>

                    <select
                        className="dashboard-products-sort"
                        value={sortValue}
                        onChange={(event) => setSortValue(event.target.value)}
                    >
                        <option value="updated-desc">{productsCopy.sortOptions.updatedDesc}</option>
                        <option value="updated-asc">{productsCopy.sortOptions.updatedAsc}</option>
                        <option value="created-desc">{productsCopy.sortOptions.createdDesc}</option>
                        <option value="created-asc">{productsCopy.sortOptions.createdAsc}</option>
                        <option value="name-asc">{productsCopy.sortOptions.nameAsc}</option>
                        <option value="status">{productsCopy.sortOptions.status}</option>
                    </select>

                    <button
                        type="button"
                        className="ghost-action"
                        onClick={() => navigate('/editor')}
                    >
                        {productsCopy.createProduct}
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
                            <strong>{selectedIds.length} {productsCopy.selectedLabel}</strong>
                        ) : (
                            <strong>{productsCopy.workspaceUpdates}</strong>
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
                                {productsCopy.clearSelection}
                            </button>
                        )}
                        <button
                            type="button"
                            className="dashboard-products-delete-btn"
                            onClick={() => handleDeleteProjects(selectedIds)}
                            disabled={selectedIds.length === 0 || isDeleting}
                        >
                            {isDeleting ? productsCopy.deleting : productsCopy.deleteSelected}
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
                        <span>{productsCopy.selectAll}</span>
                    </label>
                    <span>{productsCopy.columns.product}</span>
                    <span>{productsCopy.columns.type}</span>
                    <span>{productsCopy.columns.updated}</span>
                    <span>{productsCopy.columns.status}</span>
                    <span className="dashboard-products-actions-head">{productsCopy.columns.actions}</span>
                </div>

                <div className="dashboard-products-table-body">
                    {projectsLoading && Array.from({ length: 5 }).map((_, index) => (
                        <ProjectListSkeletonRow key={index} />
                    ))}

                    {!projectsLoading && projects.length === 0 && (
                        <div className="dashboard-empty-state">
                            <h3>{productsCopy.noProjectsTitle}</h3>
                            <p>{productsCopy.noProjectsDescription}</p>
                        </div>
                    )}

                    {!projectsLoading && projects.length > 0 && filteredProjects.length === 0 && (
                        <div className="dashboard-empty-state">
                            <h3>{productsCopy.noSearchTitle}</h3>
                            <p>{productsCopy.noSearchDescription}</p>
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
                                        <p>{formatProductType(project.productType, language)} {productsCopy.productDraftSuffix}</p>
                                        <span>{productsCopy.templateIdLabel}: {project.templateId}</span>
                                    </div>
                                </div>

                                <div className="dashboard-products-meta-cell">
                                    <strong>{formatProductType(project.productType, language)}</strong>
                                    <span>{project.productType || 'custom'}</span>
                                </div>

                                <div className="dashboard-products-meta-cell">
                                    <strong>{formatDateTime(project.updatedAt, language)}</strong>
                                    <span>{productsCopy.createdLabel} {formatDateTime(project.createdAt, language)}</span>
                                </div>

                                <div className="dashboard-products-status-cell">
                                    <span className={`dashboard-products-status status-${project.status || 'draft'}`}>
                                        {formatProjectStatus(project.status, productsCopy.statusLabels)}
                                    </span>
                                </div>

                                <div className="dashboard-products-actions-cell">
                                    <button
                                        type="button"
                                        className="dashboard-products-icon-btn"
                                        onClick={() => navigate(buildEditorUrl(project.templateId, project.id))}
                                        title={productsCopy.resumeInStudio}
                                    >
                                        <EditIcon />
                                    </button>
                                    <button
                                        type="button"
                                        className="dashboard-products-icon-btn danger"
                                        onClick={() => handleDeleteProjects([project.id])}
                                        disabled={isBusy || isDeleting}
                                        title={productsCopy.deleteProduct}
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

function AccountView({ user, onLogout, copy }) {
    const accountCopy = copy.accountView;

    return (
        <section className="dashboard-section-card">
            <div className="dashboard-section-head">
                <div>
                    <p className="section-kicker">{accountCopy.sectionKicker}</p>
                    <h2>{accountCopy.title}</h2>
                </div>
            </div>

            <div className="dashboard-account-panel">
                <div className="dashboard-account-hero">
                    <div className="dashboard-account-avatar">
                        {getInitials(user?.displayName || user?.email)}
                    </div>

                    <div className="dashboard-account-copy">
                        <h3>{user?.displayName || accountCopy.fallbackName}</h3>
                        <p>{user?.email || accountCopy.noEmail}</p>
                    </div>
                </div>

                <div className="dashboard-account-details">
                    <div className="dashboard-detail-row">
                        <span>{accountCopy.emailLabel}</span>
                        <strong>{user?.email || accountCopy.noEmail}</strong>
                    </div>
                    <div className="dashboard-detail-row">
                        <span>{accountCopy.statusLabel}</span>
                        <strong>{accountCopy.authenticated}</strong>
                    </div>
                </div>

                <div className="dashboard-account-actions">
                    <button
                        type="button"
                        className="header-outline-action"
                        onClick={onLogout}
                    >
                        {accountCopy.logout}
                    </button>
                </div>
            </div>
        </section>
    );
}

export default function DashboardPage({ search }) {
    const { isAuthenticated, isInitializing, user, logout, token } = useAuth();
    const { language, setLanguage, languageOptions } = useLanguage();
    const [productType, setProductType] = useState('all');
    const currentTab = useMemo(() => resolveDashboardTab(search), [search]);
    const copy = DASHBOARD_COPY[language] || DASHBOARD_COPY.en;
    const dashboardTabs = useMemo(() => (
        DASHBOARD_TABS.map((item) => ({
            ...item,
            label: copy.tabs[item.labelKey] || item.labelKey,
        }))
    ), [copy]);
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
                <span>{copy.loadingWorkspace}</span>
            </div>
        );
    }

    const activeTabMeta = dashboardTabs.find((item) => item.key === currentTab) || dashboardTabs[0];
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
                        <small>{copy.overview.heroEyebrow}</small>
                    </div>
                </button>

                <nav className="dashboard-sidebar-nav" aria-label="Workspace sections">
                    {dashboardTabs.map((item) => (
                        <SidebarNavButton
                            key={item.key}
                            isActive={item.key === currentTab}
                            label={item.label}
                            icon={item.icon}
                            onClick={() => navigate(buildDashboardUrl(item.key))}
                        />
                    ))}
                </nav>

                <LanguageSidebarControl
                    language={language}
                    setLanguage={setLanguage}
                    languageOptions={languageOptions}
                    labels={copy}
                />

                <button
                    type="button"
                    className={`dashboard-account-summary${currentTab === 'account' ? ' active' : ''}`}
                    onClick={() => navigate(buildDashboardUrl('account'))}
                >
                    <span className="dashboard-account-summary-avatar">
                        {getInitials(userLabel)}
                    </span>
                    <span className="dashboard-account-summary-copy">
                        <strong>{copy.tabs.account}</strong>
                        <small>{user?.email || copy.accountView.noEmail}</small>
                    </span>
                </button>
            </aside>

            <main className="dashboard-main">
                <div className="dashboard-main-head">
                    <div>
                        <p className="dashboard-eyebrow">{copy.signedIn}</p>
                        <h1>{activeTabMeta.label}</h1>
                        <p className="dashboard-main-subtitle">
                            {currentTab === 'dashboard' && copy.dashboardSubtitles.dashboard}
                            {currentTab === 'products' && copy.dashboardSubtitles.products}
                            {currentTab === 'account' && copy.dashboardSubtitles.account}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="primary-action"
                        onClick={() => navigate('/editor')}
                    >
                        {copy.openDesignStudio}
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
                        language={language}
                        copy={copy}
                    />
                )}

                {currentTab === 'products' && (
                    <ProductsView
                        projects={projects}
                        projectsLoading={projectsLoading}
                        projectsError={projectsError}
                        refreshProjects={refreshProjects}
                        token={token}
                        language={language}
                        copy={copy}
                    />
                )}

                {currentTab === 'account' && (
                    <AccountView user={user} onLogout={handleLogout} copy={copy} />
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

function LanguageIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm6.92 9h-3.06a15.56 15.56 0 0 0-1.24-5.05A8.03 8.03 0 0 1 18.92 11ZM12 4.04c1.11 1.34 1.99 3.94 2.17 6.96H9.83C10.01 7.98 10.89 5.38 12 4.04ZM9.38 5.95A15.56 15.56 0 0 0 8.14 11H5.08a8.03 8.03 0 0 1 4.3-5.05ZM4.26 13h3.88a15.9 15.9 0 0 0 1.24 5.44A8.02 8.02 0 0 1 4.26 13ZM12 19.96c-1.11-1.34-1.99-3.94-2.17-6.96h4.34c-.18 3.02-1.06 5.62-2.17 6.96Zm2.62-1.52A15.9 15.9 0 0 0 15.86 13h3.88a8.02 8.02 0 0 1-5.12 5.44Z"
                fill="currentColor"
            />
        </svg>
    );
}

function ChevronDownIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="m6.7 9.3 5.3 5.3 5.3-5.3 1.4 1.4-6.7 6.7-6.7-6.7 1.4-1.4Z"
                fill="currentColor"
            />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="m9.55 16.6-4.2-4.2 1.4-1.4 2.8 2.8 7-7 1.4 1.4-8.4 8.4Z"
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
