import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-outline h-8 text-xs px-3">
            {cancelLabel}
          </button>
          <button
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className={
              'h-8 text-xs px-3 rounded-md text-white font-medium ' +
              (destructive
                ? 'bg-red-500 hover:bg-red-400'
                : 'bg-kibo-accentDeep hover:bg-kibo-accent')
            }
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {destructive && (
        <div className="flex items-start gap-3 text-sm text-kibo-muted">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <span>Esta acción no se puede deshacer.</span>
        </div>
      )}
    </Modal>
  );
}
