import { formatProductType } from '../../shared/lib/formatters';

function getTemplatePreview(template) {
    if (template?.thumbnailUrl) return template.thumbnailUrl;

    const firstSurface = Object.values(template?.surfaces || {})[0];
    return firstSurface?.templateImageUrl || '/front.svg';
}

export default function TemplateGrid({
    productType,
    onProductTypeChange,
    templates,
    isLoading,
    errorMessage,
}) {
    return (
        <section className="home-section" id="catalog">
            <div className="section-heading">
                <div>
                    <p className="section-kicker">Catalog</p>
                    <h2>Explore premium apparel templates ready for customization.</h2>
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

            {errorMessage && (
                <div className="home-inline-note">
                    We could not load the live catalog right now, so local product templates are being shown instead.
                </div>
            )}

            <div className="template-grid">
                {isLoading && Array.from({ length: 3 }).map((_, index) => (
                    <article key={index} className="template-card template-card-skeleton">
                        <div className="template-thumb skeleton-box" />
                        <div className="skeleton-line skeleton-line-title" />
                        <div className="skeleton-line" />
                        <div className="skeleton-line skeleton-line-short" />
                    </article>
                ))}

                {!isLoading && templates.map((template) => (
                    <article key={template.id || template.slug} className="template-card">
                        <div className="template-card-top">
                            <span className="template-type-chip">{formatProductType(template.productType)}</span>
                            <span className="template-slug-chip">{template.slug}</span>
                        </div>

                        <div className="template-thumb">
                            <img src={getTemplatePreview(template)} alt={template.name} />
                        </div>

                        <div className="template-card-body">
                            <h3>{template.name}</h3>
                            <p>{template.description || 'Template metadata is ready for product creation flows.'}</p>
                        </div>

                        <div className="template-surface-list">
                            {Object.entries(template?.surfaces || {}).map(([surfaceKey, surface]) => (
                                <span key={surfaceKey} className="template-surface-chip">
                                    {surface?.label || surfaceKey}
                                </span>
                            ))}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
