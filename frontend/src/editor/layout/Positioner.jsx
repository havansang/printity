import { useEffect, useRef, useState } from 'react';
import { useEditor } from './EditorContext';

const WHEEL_ZOOM_STEP = 1.1;

export default function Positioner({ children }) {
    const { zoomLevel, applyZoom, isPanMode } = useEditor();
    const [pos, setPos] = useState({ x: 0, y: 0 });

    const spacePressedRef = useRef(false);
    const draggingRef = useRef(false);
    const startRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const down = (e) => {
            if (e.code === 'Space') spacePressedRef.current = true;
        };
        const up = (e) => {
            if (e.code === 'Space') spacePressedRef.current = false;
        };

        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);

        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, []);

    const wheel = (e) => {
        e.preventDefault();
        const next = e.deltaY > 0 ? zoomLevel / WHEEL_ZOOM_STEP : zoomLevel * WHEEL_ZOOM_STEP;
        applyZoom(next);
    };

    const mouseDown = (e) => {
        if (!spacePressedRef.current && !isPanMode) return;
        e.preventDefault();
        draggingRef.current = true;
        startRef.current = {
            x: e.clientX - pos.x,
            y: e.clientY - pos.y,
        };
    };

    const mouseMove = (e) => {
        if (!draggingRef.current) return;
        setPos({
            x: e.clientX - startRef.current.x,
            y: e.clientY - startRef.current.y,
        });
    };

    const mouseUp = () => {
        draggingRef.current = false;
    };

    return (
        <div
            className="viewport"
            onWheel={wheel}
            onMouseDown={mouseDown}
            onMouseMove={mouseMove}
            onMouseUp={mouseUp}
            onMouseLeave={mouseUp}
        >
            <div
                className="positioner"
                style={{
                    transform: `translate(${pos.x}px,${pos.y}px) scale(${zoomLevel})`,
                    cursor: (isPanMode || spacePressedRef.current) ? 'grab' : 'default',
                }}
            >
                {children}
            </div>
        </div>
    );
}
