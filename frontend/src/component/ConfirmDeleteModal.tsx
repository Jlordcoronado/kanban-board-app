import { Dialog } from './Dialog';

interface ConfirmDeleteModalProps {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteModal({
  title,
  message,
  confirmText = 'Delete',
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  return (
    <Dialog
      title={title}
      className="task-discard"
      hideClose
      dismissOnBackdrop
      onClose={onClose}
    >
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="task-actions">
        <button
          type="button"
          className="task-button task-secondary"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="task-button task-danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmText}
        </button>
      </div>
    </Dialog>
  );
}
