import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Braces,
  ChevronDown,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react';
import { TemplateVariable } from '../../types/outreach';
import { SUPPORTED_VARIABLES, VARIABLE_LABELS } from '../../utils/personalization';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  ariaLabel?: string;
  /** Offer lead variables ({{name}} …). Off for content like signatures. */
  allowVariables?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your message here...',
  minHeightClass = 'min-h-[220px]',
  ariaLabel = 'Email body editor',
  allowVariables = true,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  /** True when the variable menu was opened by typing "{{". */
  const bracesTriggerRef = useRef(false);
  const [varMenuOpen, setVarMenuOpen] = useState(false);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [isEmpty, setIsEmpty] = useState(() => !value || value === '<br>');
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the toolbar popovers on outside click or Escape.
  useEffect(() => {
    if (!varMenuOpen && !linkPopoverOpen) return;
    const close = () => {
      setVarMenuOpen(false);
      setLinkPopoverOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('mousedown', onPointer);
    rootRef.current?.addEventListener('keydown', onKey);
    const root = rootRef.current;
    return () => {
      document.removeEventListener('mousedown', onPointer);
      root?.removeEventListener('keydown', onKey);
    };
  }, [varMenuOpen, linkPopoverOpen]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
    const text = el.textContent?.trim() ?? '';
    setIsEmpty(text.length === 0 && !value.includes('<li'));
  }, [value]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  };

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    const text = el.textContent?.trim() ?? '';
    setIsEmpty(text.length === 0 && !html.includes('<li'));
    onChange(html);
  };

  const execFormat = (command: string, commandVal?: string) => {
    restoreSelection();
    document.execCommand(command, false, commandVal);
    saveSelection();
    emitChange();
  };

  const handleInsertVariable = (variable: TemplateVariable) => {
    const token = `{{${variable}}}`;
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      // Replace the "{{" the user typed to open the menu.
      if (bracesTriggerRef.current && range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset >= 2) {
        const text = range.startContainer.textContent ?? '';
        if (text.slice(range.startOffset - 2, range.startOffset) === '{{') {
          range.setStart(range.startContainer, range.startOffset - 2);
        }
      }
      bracesTriggerRef.current = false;
      range.deleteContents();
      const textNode = document.createTextNode(token);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
    } else if (editorRef.current) {
      editorRef.current.innerHTML += token;
    }
    setVarMenuOpen(false);
    emitChange();
  };

  const handleApplyLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      setLinkPopoverOpen(false);
      return;
    }
    const safeUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) {
      const anchor = document.createElement('a');
      anchor.href = safeUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = safeUrl;
      const range = sel.getRangeAt(0);
      range.insertNode(anchor);
      range.setStartAfter(anchor);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      document.execCommand('createLink', false, safeUrl);
    }
    setLinkPopoverOpen(false);
    setLinkUrl('https://');
    emitChange();
  };

  return (
    <div ref={rootRef} className="rounded-md border border-line-strong bg-surface focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 transition-[border-color,box-shadow]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-line bg-canvas rounded-t-md">
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('bold')}
            aria-label="Bold"
            title="Bold"
            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-muted transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('italic')}
            aria-label="Italic"
            title="Italic"
            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-muted transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('underline')}
            aria-label="Underline"
            title="Underline"
            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-muted transition-colors"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          <span className="mx-1.5 h-3.5 w-px bg-line-strong" aria-hidden="true" />

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('insertUnorderedList')}
            aria-label="Bullet list"
            title="Bullet list"
            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-muted transition-colors"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('insertOrderedList')}
            aria-label="Numbered list"
            title="Numbered list"
            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-muted transition-colors"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                saveSelection();
                setLinkPopoverOpen((v) => !v);
                setVarMenuOpen(false);
              }}
              aria-label="Insert hyperlink"
              title="Insert hyperlink"
              className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-muted transition-colors"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
            {linkPopoverOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-30 w-72 rounded-lg bg-surface border border-line-strong shadow-overlay p-3">
                <label className="block text-xs font-medium text-ink-3 mb-1.5">
                  Link URL
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-md border border-line-strong focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={handleApplyLink}
                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-accent rounded-md hover:bg-accent-ink whitespace-nowrap"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          <span className="mx-1.5 h-3.5 w-px bg-line-strong" aria-hidden="true" />

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('undo')}
            aria-label="Undo"
            title="Undo"
            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-muted transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('redo')}
            aria-label="Redo"
            title="Redo"
            className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-muted transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Variable insertion — also opens when typing "{{" */}
        {allowVariables && (
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              saveSelection();
              bracesTriggerRef.current = false;
              setVarMenuOpen((v) => !v);
              setLinkPopoverOpen(false);
            }}
            aria-label="Insert variable"
            title="Insert variable (or type {{)"
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-ink-3 transition-colors hover:bg-muted hover:text-ink"
          >
            <Braces className="w-3.5 h-3.5" />
            <ChevronDown className="w-3 h-3" />
          </button>

          {varMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-lg bg-surface border border-line shadow-overlay p-1"
            >
              {SUPPORTED_VARIABLES.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertVariable(variable)}
                  className="w-full flex items-center justify-between rounded-md px-2 h-8 text-left text-ui hover:bg-subtle transition-colors"
                >
                  <span className="text-ink">
                    {VARIABLE_LABELS[variable]}
                  </span>
                  <code className="font-mono text-[11px] text-ink-3">
                    {`{{${variable}}}`}
                  </code>
                </button>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Editable Content Surface */}
      <div className="relative">
        {isEmpty && (
          <div className="pointer-events-none absolute top-3.5 left-4 text-sm text-ink-4">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            emitChange();
            if (!allowVariables) return;
            const sel = window.getSelection();
            const node = sel?.anchorNode;
            const before =
              node && node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '').slice(0, sel!.anchorOffset) : '';
            if (before.endsWith('{{')) {
              saveSelection();
              bracesTriggerRef.current = true;
              setVarMenuOpen(true);
            } else if (bracesTriggerRef.current) {
              bracesTriggerRef.current = false;
              setVarMenuOpen(false);
            }
          }}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onBlur={saveSelection}
          className={`mailflow-editor-content px-4 py-3.5 text-sm ${minHeightClass}`}
        />
      </div>
    </div>
  );
}
