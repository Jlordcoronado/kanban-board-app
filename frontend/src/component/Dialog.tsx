import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
export function Dialog({
  title,
  onClose,
  children,
  returnFocusRef,
  className = '',
  hideClose = false,
  dismissOnBackdrop = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  hideClose?: boolean;
  dismissOnBackdrop?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    const returnTo = returnFocusRef?.current ?? previous;
    dialog.showModal();
    return () => {
      dialog.close();
      returnTo?.focus();
    };
  }, [returnFocusRef]);
  return (
    <dialog
      ref={ref}
      className={`board-dialog ${className}`}
      aria-label={title}
      onClick={(event) => {
        if (!dismissOnBackdrop || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          close.current();
      }}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }}
    >
      {!hideClose && (
        <button
          className="auth-theme dialog-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          Close
        </button>
      )}
      {children}
    </dialog>
  );
}
