import { useEditor } from './EditorContext';

const FONT_FAMILIES = [
    'Inter, sans-serif', 'Georgia, serif', 'Courier New, monospace',
    'Arial, sans-serif', 'Verdana, sans-serif', 'Times New Roman, serif',
    'Impact, sans-serif', 'Trebuchet MS, sans-serif',
];
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96];

export default function TopBar() {
    const {
        undo, redo, canUndo, canRedo,
        selectedObjectType, textStyle, updateTextStyle,
        deleteSelected, duplicateSelected,
        isPreviewMode, setIsPreviewMode,
    } = useEditor();

    const isBold = textStyle.fontWeight === 'bold';
    const isItalic = textStyle.fontStyle === 'italic';

    return (
        <header className="top-bar" id="top-bar">
            {/* Left */}
            <div className="tb-group tb-left">
                <button className="tb-icon-btn tb-back" id="btn-back" title="Back">
                    <ChevronLeft />
                </button>
                <span className="tb-title">T-Shirt Design</span>
            </div>

            {/* Center */}
            <div className="tb-center">
                <div className="tb-group">
                    <button className="tb-icon-btn" id="btn-undo" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><UndoIcon /></button>
                    <button className="tb-icon-btn" id="btn-redo" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"><RedoIcon /></button>
                    {selectedObjectType && <div className="tb-divider" />}
                </div>

                {/* Text contextual */}
                {selectedObjectType === 'text' && (
                    <div className="tb-group tb-contextual" id="text-ctx-bar">
                        <select
                            className="tb-select tb-font-sel"
                            id="tb-font-family"
                            value={textStyle.fontFamily}
                            onChange={(e) => updateTextStyle('fontFamily', e.target.value)}
                        >
                            {FONT_FAMILIES.map((f) => (
                                <option key={f} value={f} style={{ fontFamily: f }}>{f.split(',')[0]}</option>
                            ))}
                        </select>
                        <select
                            className="tb-select tb-size-sel"
                            id="tb-font-size"
                            value={textStyle.fontSize}
                            onChange={(e) => updateTextStyle('fontSize', Number(e.target.value))}
                        >
                            {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="tb-divider" />
                        <button className={`tb-icon-btn${isBold ? ' active' : ''}`} id="tb-bold" onClick={() => updateTextStyle('fontWeight', isBold ? 'normal' : 'bold')} title="Bold"><BoldIcon /></button>
                        <button className={`tb-icon-btn${isItalic ? ' active' : ''}`} id="tb-italic" onClick={() => updateTextStyle('fontStyle', isItalic ? 'normal' : 'italic')} title="Italic"><ItalicIcon /></button>
                        <div className="tb-divider" />
                        {['left', 'center', 'right'].map((a) => (
                            <button
                                key={a}
                                className={`tb-icon-btn${textStyle.textAlign === a ? ' active' : ''}`}
                                id={`tb-align-${a}`}
                                onClick={() => updateTextStyle('textAlign', a)}
                                title={`Align ${a}`}
                            >
                                {a === 'left' && <AlignL />}
                                {a === 'center' && <AlignC />}
                                {a === 'right' && <AlignR />}
                            </button>
                        ))}
                        <div className="tb-divider" />
                        <label className="tb-color-lbl" title="Text Color">
                            <div className="tb-color-dot" style={{ background: textStyle.fill?.startsWith('#') ? textStyle.fill : '#222' }} />
                            <input type="color" className="tb-color-inp" id="tb-color" value={textStyle.fill?.startsWith('#') ? textStyle.fill : '#222222'} onChange={(e) => updateTextStyle('fill', e.target.value)} />
                        </label>
                        <div className="tb-divider" />
                        <button className="tb-icon-btn" id="tb-dup" onClick={duplicateSelected} title="Duplicate"><DupIcon /></button>
                        <button className="tb-icon-btn tb-del" id="tb-del" onClick={deleteSelected} title="Delete"><DelIcon /></button>
                    </div>
                )}

                {/* Image/Shape contextual */}
                {(selectedObjectType === 'image' || selectedObjectType === 'shape') && (
                    <div className="tb-group tb-contextual" id="obj-ctx-bar">
                        <button className="tb-icon-btn" id="tb-dup-obj" onClick={duplicateSelected} title="Duplicate"><DupIcon /></button>
                        <button className="tb-icon-btn tb-del" id="tb-del-obj" onClick={deleteSelected} title="Delete"><DelIcon /></button>
                    </div>
                )}
            </div>

            {/* Right */}
            <div className="tb-group tb-right">
                <div className="mode-pill" id="mode-pill">
                    <button className={`mode-btn${!isPreviewMode ? ' active' : ''}`} id="mode-edit" onClick={() => setIsPreviewMode(false)}>Edit</button>
                    <button className={`mode-btn${isPreviewMode ? ' active' : ''}`} id="mode-preview" onClick={() => setIsPreviewMode(true)}>Preview</button>
                </div>
            </div>
        </header>
    );
}

/* Icons */
const ChevronLeft = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>;
const UndoIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>;
const RedoIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" /></svg>;
const BoldIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></svg>;
const ItalicIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>;
const AlignL = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>;
const AlignC = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>;
const AlignR = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>;
const DupIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
const DelIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>;
