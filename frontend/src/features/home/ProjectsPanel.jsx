import { navigate } from '../../app/router';
import { formatDateTime, formatProductType } from '../../shared/lib/formatters';

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

export default function ProjectsPanel({
    isAuthenticated,
    isInitializing,
    projects,
    isLoading,
    errorMessage,
}) {
    return (
        <section className="home-section home-section-projects" id="solutions">
            <div className="section-heading">
                <div>
                    <p className="section-kicker">Solutions</p>
                    <h2>Manage saved drafts and launch-ready product ideas in one place.</h2>
                </div>
            </div>

            {!isAuthenticated && !isInitializing && (
                <div className="project-gate">
                    <div>
                        <h3>Sign in to unlock saved drafts, completed products and editor history.</h3>
                        <p>
                            Keep all product work in one dashboard, from first concept to polished release-ready design.
                        </p>
                    </div>
                    <div className="project-gate-actions">
                        <button type="button" className="primary-action" onClick={() => navigate('/auth?mode=login')}>
                            Sign in
                        </button>
                        <button type="button" className="secondary-action" onClick={() => navigate('/auth?mode=register')}>
                            Create account
                        </button>
                    </div>
                </div>
            )}

            {isAuthenticated && (
                <div className="project-panel">
                    {errorMessage && <div className="home-inline-note home-inline-note-warn">{errorMessage}</div>}

                    {isLoading && (
                        <div className="project-list">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <article key={index} className="project-card project-card-skeleton">
                                    <div className="skeleton-line skeleton-line-title" />
                                    <div className="skeleton-line" />
                                    <div className="skeleton-line skeleton-line-short" />
                                </article>
                            ))}
                        </div>
                    )}

                    {!isLoading && projects.length === 0 && (
                        <div className="project-empty">
                            <h3>No saved projects yet.</h3>
                            <p>
                                Start your first design in the studio and your saved drafts will appear here for quick access.
                            </p>
                        </div>
                    )}

                    {!isLoading && projects.length > 0 && (
                        <div className="project-list">
                            {projects.map((project) => (
                                <article key={project.id} className="project-card">
                                    <div className="project-card-top">
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
                                        onClick={() => navigate(buildEditorUrl(project.templateId, project.id))}
                                    >
                                        Resume in studio
                                    </button>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
