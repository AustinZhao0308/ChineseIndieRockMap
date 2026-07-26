import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Bold, ImagePlus, Italic, LibraryBig, List, ListOrdered, Quote, RemoveFormatting, SeparatorHorizontal, Underline } from "lucide-react";

export type RichTextEditorHandle = {
  insertImage: (url: string) => void;
};

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onUploadImage: () => void;
  onOpenAssets: () => void;
};

const colors = ["#ffffff", "#ffb18a", "#ff4e00", "#fac86e", "#8fcb9b"];

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#039;");

const editableHtml = (value: string) => {
  if (!value.trim() || /<\/?[a-z][^>]*>/i.test(value)) return value;
  return value.split(/\n\s*\n/).filter(Boolean).map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
};

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor({ value, onChange, onUploadImage, onOpenAssets }, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    const nextValue = editableHtml(value);
    if (editor && editor.innerHTML !== nextValue) editor.innerHTML = nextValue;
  }, [value]);

  const emitChange = () => onChange(editorRef.current?.innerHTML || "");

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount) selectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (selectionRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
  };

  const command = (name: string, value?: string) => {
    restoreSelection();
    document.execCommand(name, false, value);
    rememberSelection();
    emitChange();
  };

  const insertImage = (url: string) => {
    restoreSelection();
    document.execCommand("insertImage", false, url);
    const image = editorRef.current?.querySelector<HTMLImageElement>("img:last-of-type");
    if (image) image.alt = "正文图片";
    rememberSelection();
    emitChange();
  };

  useImperativeHandle(ref, () => ({ insertImage }));

  const toolbarButton = (label: string, action: () => void, content: React.ReactNode, activeClass = "") => (
    <button type="button" title={label} aria-label={label} onMouseDown={event => event.preventDefault()} onClick={action} className={`rich-editor-button ${activeClass}`}>{content}</button>
  );

  return <div className="rich-editor-shell">
    <div className="rich-editor-toolbar" onMouseDown={rememberSelection}>
      <div className="rich-editor-group">
        {toolbarButton("粗体", () => command("bold"), <Bold size={15} />)}
        {toolbarButton("斜体", () => command("italic"), <Italic size={15} />)}
        {toolbarButton("下划线", () => command("underline"), <Underline size={15} />)}
        {toolbarButton("清除格式", () => command("removeFormat"), <RemoveFormatting size={15} />)}
      </div>
      <div className="rich-editor-group">
        <select
          aria-label="段落样式"
          defaultValue="p"
          onMouseDown={rememberSelection}
          onChange={event => {
            command("formatBlock", event.target.value);
            event.currentTarget.value = "p";
          }}
          className="rich-editor-format"
        >
          <option value="p">正文</option>
          <option value="h1">H1 标题</option>
          <option value="h2">H2 小标题</option>
          <option value="h3">H3 小标题</option>
        </select>
        {toolbarButton("无序列表", () => command("insertUnorderedList"), <List size={15} />)}
        {toolbarButton("有序列表", () => command("insertOrderedList"), <ListOrdered size={15} />)}
        {toolbarButton("引用", () => command("formatBlock", "blockquote"), <Quote size={15} />)}
        {toolbarButton("分隔线", () => command("insertHorizontalRule"), <SeparatorHorizontal size={15} />)}
      </div>
      <div className="rich-editor-group rich-editor-colors" aria-label="文字颜色">
        {colors.map(color => <button key={color} type="button" title="设置文字颜色" aria-label={`设置文字颜色 ${color}`} onMouseDown={event => event.preventDefault()} onClick={() => command("foreColor", color)} className="rich-editor-color" style={{ backgroundColor: color }} />)}
      </div>
      <div className="rich-editor-group ml-auto">
        {toolbarButton("上传并插入图片", onUploadImage, <ImagePlus size={15} />)}
        {toolbarButton("从素材库插入图片", onOpenAssets, <LibraryBig size={15} />)}
      </div>
    </div>
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder="开始写正文。可使用上方工具调整文字、插入图片和组织段落。"
      className="rich-editor-content rich-content"
      onInput={() => { rememberSelection(); emitChange(); }}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      onBlur={emitChange}
      onPaste={event => {
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
        emitChange();
      }}
    />
  </div>;
});

export default RichTextEditor;
