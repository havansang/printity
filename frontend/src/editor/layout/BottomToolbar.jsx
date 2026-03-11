import { useEffect, useState } from 'react';
import { useEditor } from './EditorContext';

const ZOOM_STEP = 1.1;

export default function BottomToolbar() {
    const { zoomLevel, zoomMin, zoomMax, applyZoom, isPanMode, togglePanMode } = useEditor();
    const [spacePressed, setSpacePressed] = useState(false);
    const pct = Math.round(zoomLevel * 100);
    const handActive = isPanMode || spacePressed;

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code === 'Space') setSpacePressed(true);
        };
        const onKeyUp = (e) => {
            if (e.code === 'Space') setSpacePressed(false);
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    const handleStepClick = (dir) => {
        const next = dir === 'in' ? zoomLevel * ZOOM_STEP : zoomLevel / ZOOM_STEP;
        applyZoom(next);
    };

    return (
        <footer className="bottom-toolbar" id="bottom-toolbar">
            <div className="bt-group bt-left">
                <button
                    className="bt-btn"
                    id="bt-zoom-out"
                    onClick={() => handleStepClick('out')}
                    disabled={zoomLevel <= zoomMin}
                    title="Zoom Out"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>

                <span className="bt-zoom-pct" id="bt-zoom-pct">{pct}%</span>

                <button
                    className="bt-btn"
                    id="bt-zoom-in"
                    onClick={() => handleStepClick('in')}
                    disabled={zoomLevel >= zoomMax}
                    title="Zoom In"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>

                <div className="bt-divider" />

                <button
                    className={`bt-btn bt-hand${handActive ? ' active' : ''}`}
                    id="bt-hand"
                    onClick={() => togglePanMode()}
                    title={isPanMode ? 'Switch to Select tool' : 'Hand tool (pan canvas)'}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={handActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                        <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                    </svg>
                    <span>Hand</span>
                </button>
            </div>

            <div className="bt-group bt-right">
                <button className="bt-save-btn" id="bt-save">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                    Save Product
                </button>
            </div>
        </footer>
    );
}
