import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

interface MenuAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}
interface ActionMenuProps {
  label: string;
  items: MenuAction[];
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

const OPEN_EVENT = 'kanban-action-menu-open';

export function ActionMenu({ label, items, triggerRef }: ActionMenuProps) {
  const id = useId();
  const localTrigger = useRef<HTMLButtonElement>(null);
  const trigger = triggerRef ?? localTrigger;
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 0 });
  const initialItem = useRef<'first' | 'last'>('first');

  useEffect(() => {
    const otherOpened = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, otherOpened);
    return () => window.removeEventListener(OPEN_EVENT, otherOpened);
  }, [id]);

  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const bounds = menu.current.getBoundingClientRect();
    const margin = 8;
    const maxHeight = Math.max(0, window.innerHeight - margin * 2);
    const height = Math.min(bounds.height, maxHeight);
    const below = window.innerHeight - anchor.bottom - 6 - margin;
    const above = anchor.top - 6 - margin;
    const top =
      below < height && above > below
        ? anchor.top - 6 - height
        : anchor.bottom + 6;
    setPosition({
      left: Math.max(
        margin,
        Math.min(
          anchor.right - bounds.width,
          window.innerWidth - bounds.width - margin
        )
      ),
      top: Math.max(
        margin,
        Math.min(top, window.innerHeight - height - margin)
      ),
      maxHeight,
    });
    const enabled = menu.current.querySelectorAll<HTMLButtonElement>(
      'button:not(:disabled)'
    );
    enabled[initialItem.current === 'last' ? enabled.length - 1 : 0]?.focus();
  }, [open, trigger]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        setOpen(false);
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target))
        return;
      setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('dragstart', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('dragstart', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open, trigger]);

  const show = (first: 'first' | 'last' = 'first') => {
    initialItem.current = first;
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    setOpen(true);
  };
  const dismissToTrigger = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <span
      className="board-action-anchor"
      data-card-actions="true"
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="board-icon-button"
        draggable={false}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? dismissToTrigger() : show())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            show(e.key === 'ArrowUp' ? 'last' : 'first');
          }
        }}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label={label}
            className="board-action-menu"
            data-card-actions="true"
            style={{
              left: position.left,
              top: position.top,
              maxHeight: position.maxHeight || 'calc(100dvh - 16px)',
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              const enabled = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  'button:not(:disabled)'
                )
              );
              const index = enabled.indexOf(
                document.activeElement as HTMLButtonElement
              );
              if (e.key === 'Escape') {
                e.preventDefault();
                dismissToTrigger();
              } else if (e.key === 'Tab') dismissToTrigger();
              else if (
                ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)
              ) {
                e.preventDefault();
                const next =
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? enabled.length - 1
                      : (index +
                          (e.key === 'ArrowDown' ? 1 : -1) +
                          enabled.length) %
                        enabled.length;
                enabled[next]?.focus();
              } else if (e.key.length === 1 && /\S/.test(e.key)) {
                const ordered = [
                  ...enabled.slice(index + 1),
                  ...enabled.slice(0, index + 1),
                ];
                const match = ordered.find((item) =>
                  item.textContent
                    ?.toLowerCase()
                    .startsWith(e.key.toLowerCase())
                );
                if (match) {
                  e.preventDefault();
                  match.focus();
                }
              }
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`board-menu-item${item.danger ? ' board-menu-danger' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  dismissToTrigger();
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </span>
  );
}
