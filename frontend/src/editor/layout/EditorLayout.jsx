import { EditorProvider } from './EditorContext';
import TopBar from './TopBar';
import CanvasWorkspace from './CanvasWorkspace';
import LeftToolbar from './LeftToolbar';
import RightPanel from './RightPanel';
import BottomToolbar from './BottomToolbar';
import './editor.css';

export default function EditorLayout() {
    return (
        <EditorProvider>
            <div className="editor-shell">
                <TopBar />
                <div className="editor-body">
                    <LeftToolbar />
                    <CanvasWorkspace />
                    <RightPanel />
                </div>
                <BottomToolbar />
            </div>
        </EditorProvider>
    );
}
