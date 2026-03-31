import { EditorProvider } from './EditorContext';
import { useEditor } from './EditorContext';
import TopBar from './TopBar';
import CanvasWorkspace from './CanvasWorkspace';
import LeftToolbar from './LeftToolbar';
import RightPanel from './RightPanel';
import BottomToolbar from './BottomToolbar';
import PreviewWorkspace from './PreviewWorkspace';
import './editor.css';

export default function EditorLayout({ templateDef, initialProject = null }) {
    return (
        <EditorProvider templateDef={templateDef} initialProject={initialProject}>
            <EditorShell />
        </EditorProvider>
    );
}

function EditorShell() {
    const { isPreviewMode } = useEditor();

    return (
        <div className="editor-shell">
            <TopBar />
            <div
                className={`editor-mode-shell${isPreviewMode ? ' is-hidden' : ' is-active'}`}
                aria-hidden={isPreviewMode}
            >
                <div className="editor-body">
                    <LeftToolbar />
                    <CanvasWorkspace />
                    <RightPanel />
                </div>
                <BottomToolbar />
            </div>
            <div
                className={`editor-mode-shell${isPreviewMode ? ' is-active' : ' is-hidden'}`}
                aria-hidden={!isPreviewMode}
            >
                <PreviewWorkspace />
            </div>
        </div>
    );
}
