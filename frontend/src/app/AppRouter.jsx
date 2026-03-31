import { Suspense, lazy, useEffect, useState } from 'react';
import AuthPage from '../pages/AuthPage';
import DashboardPage from '../pages/DashboardPage';
import HomePage from '../pages/HomePage';
import AppHeader from '../shared/ui/AppHeader';
import { readRoute, subscribeToRouteChanges } from './router';

const EditorPage = lazy(() => import('../pages/EditorPage'));

function RouteFallback() {
    return (
        <div className="route-fallback">
            <div className="route-fallback-dot" />
            <span>Loading studio...</span>
        </div>
    );
}

export default function AppRouter() {
    const [route, setRoute] = useState(() => readRoute());

    useEffect(() => subscribeToRouteChanges(setRoute), []);

    if (route.pathname === '/editor') {
        return (
            <Suspense fallback={<RouteFallback />}>
                <EditorPage search={route.search} />
            </Suspense>
        );
    }

    if (route.pathname === '/auth') {
        return (
            <div className="auth-route-shell">
                <AuthPage search={route.search} />
            </div>
        );
    }

    if (route.pathname === '/dashboard') {
        return <DashboardPage search={route.search} />;
    }

    return (
        <div className="app-shell">
            <AppHeader currentPath={route.pathname} />
            <main className="app-main">
                <HomePage />
            </main>
        </div>
    );
}
