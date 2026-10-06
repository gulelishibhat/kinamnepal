import { useState, useEffect } from 'react';
import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** What is being deleted, e.g. the shop or customer name. */
  itemLabel?: string | undefined;
  message?: string | undefined;
  loading?: boolean | undefined;
}

// Destructive confirmation that requires the admin to type DELETE before the
// action is enabled — guards against accidental deletion.
export default function DeleteConfirmDialog({ open, onClose, onConfirm, title, itemLabel, message, loading = false }: Props) {
  const [text, setText] = useState('');
  const confirmed = text.trim().toUpperCase() === 'DELETE';

  // Reset the typed text whenever the dialog opens/closes.
  useEffect(() => { if (!open) setText(''); }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {message ?? 'This action cannot be undone.'}
          {itemLabel && (
            <> You are about to delete <span className="font-semibold text-gray-900">{itemLabel}</span>.</>
          )}
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
          </label>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && confirmed && !loading) onConfirm(); }}
            placeholder="DELETE"
            className="input"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary btn-sm px-4 py-2">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || loading}
            className="btn-danger btn-sm px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
