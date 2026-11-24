import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Draw a separator above this item. */
  separated?: boolean;
  hint?: ReactNode;
  /** Renders as a checkable item (multi-select filters). */
  checked?: boolean;
  /** Keep the menu open after selecting (multi-select). */
  keepOpen?: boolean;
  /** Renders as a single-choice option; the current one shows a check. */
  selected?: boolean;
}

interface MenuProps {
  /** Render prop for the trigger; spread `triggerProps` onto a button. */
  trigger: (triggerProps: {
    ref: (el: HTMLButtonElement | null) => void;
    onClick: (e: React.MouseEvent) => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
  }) => ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
  /** Pixel width, or 'trigger' to match the trigger's width (form fields). */
  width?: number | 'trigger';
  header?: ReactNode;
}

/**
 * Dropdown menu rendered in a portal so it is never clipped by scroll
 * containers (e.g. tables). Supports arrow keys, Home/End, Escape.
 */
export function Menu({ trigger, items, align = 'end', width = 196, header }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = width === 'trigger' ? Math.max(160, rect.width) : width;
    const menuHeight = menuRef.current?.offsetHeight ?? 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuHeight + 12 ? rect.top - menuHeight - 4 : rect.bottom + 4;
    let left = align === 'end' ? rect.right - menuWidth : rect.left;
    left = Math.min(Math.max(8, left), window.innerWidth - menuWidth - 8);
    setPos({ top: Math.max(8, top), left, width: menuWidth });
    // Start on the current choice in single-select menus, otherwise the first item.
    const current = menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]');
    (current ?? menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])'))?.focus({
      preventScroll: true,
    });
    current?.scrollIntoView({ block: 'nearest' });
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onResize = () => close(false);
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close(false);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? []
    );
    const idx = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nodes[(idx + 1) % nodes.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nodes[(idx - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      nodes[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      nodes[nodes.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <>
      {trigger({
        ref: (el) => {
          triggerRef.current = el;
        },
        onClick: (e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        },
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={onKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: pos?.width ?? (width === 'trigger' ? 200 : width),
            }}
            className="fixed z-[70] max-h-72 overflow-y-auto scrollbar-thin rounded-lg border border-line bg-surface p-1 shadow-overlay animate-scale-in"
          >
            {header}
            {items.map((item) => (
              <div key={item.label}>
                {item.separated && <div className="my-1 h-px bg-line" role="separator" />}
                <button
                  type="button"
                  role={
                    item.checked !== undefined
                      ? 'menuitemcheckbox'
                      : item.selected !== undefined
                      ? 'menuitemradio'
                      : 'menuitem'
                  }
                  aria-checked={item.checked ?? item.selected}
                  disabled={item.disabled}
                  onClick={() => {
                    if (!item.keepOpen) close();
                    item.onSelect();
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 h-8 px-2 rounded-md text-ui text-left outline-none',
                    'focus-visible:bg-subtle hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed',
                    '[&_svg]:size-4 [&_svg]:shrink-0',
                    item.destructive ? 'text-danger [&_svg]:text-danger' : 'text-ink [&_svg]:text-ink-3'
                  )}
                >
                  {item.checked !== undefined && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                        item.checked ? 'border-accent bg-accent text-white' : 'border-line-strong'
                      )}
                    >
                      {item.checked && <Check className="size-3! text-white!" strokeWidth={3} />}
                    </span>
                  )}
                  {item.icon}
                  <span className={cn('flex-1 truncate', item.selected && 'font-medium')}>{item.label}</span>
                  {item.hint}
                  {item.selected && <Check className="text-accent!" aria-hidden="true" />}
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
