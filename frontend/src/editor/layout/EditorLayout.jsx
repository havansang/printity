import { EditorProvider } from './EditorContext';
import { useEditor } from './EditorContext';
import TopBar from './TopBar';
import CanvasWorkspace from './CanvasWorkspace';
import LeftToolbar from './LeftToolbar';
import RightPanel from './RightPanel';
import BottomToolbar from './BottomToolbar';
import PreviewWorkspace from './PreviewWorkspace';
import './editor.css';

export default function EditorLayout() {
    return (
        <EditorProvider>
            <EditorShell />
        </EditorProvider>
    );
}

function EditorShell() {
    const { isPreviewMode } = useEditor();

    return (
        <div className="editor-shell">
            <TopBar />
            {isPreviewMode ? (
                <PreviewWorkspace />
            ) : (
                <>
                    <div className="editor-body">
                        <LeftToolbar />
                        <CanvasWorkspace />
                        <RightPanel />
                    </div>
                    <BottomToolbar />
                </>
            )}
        </div>
    );
}
