import { useEffect, useState, type FormEvent } from 'react';
import { trpc } from '../../lib/trpc';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useConfirm, useToast } from '../../components/ui';
import { AlertIcon, LinkIcon, SpinnerIcon, TrashIcon, XIcon } from '../../components/icons';

type Env = {
  id: string;
  name: string;
  branch: string | null;
  description: string | null;
  order: number;
  bookings: { id: string }[];
};

type Props = {
  existing: Env | null;
  onClose: () => void;
  canDelete?: boolean;
};

export function QaEnvironmentModal({ existing, onClose, canDelete = false }: Props) {
  const isEdit = !!existing;
  const toast = useToast();
  const confirm = useConfirm();
  const utils = trpc.useUtils();
  const trapRef = useFocusTrap<HTMLDivElement>();

  const [name, setName] = useState(existing?.name ?? '');
  const [branch, setBranch] = useState(existing?.branch ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const create = trpc.resources.createQaEnvironment.useMutation({
    onSuccess: () => {
      utils.resources.qaEnvironments.invalidate();
      toast.push({ kind: 'success', title: 'Environment added' });
      onClose();
    },
    onError: (err) => {
      setError(err.message);
      toast.push({ kind: 'error', title: 'Add failed', message: err.message });
    },
  });

  const update = trpc.resources.updateQaEnvironment.useMutation({
    onSuccess: () => {
      utils.resources.qaEnvironments.invalidate();
      toast.push({ kind: 'success', title: 'Environment updated' });
      onClose();
    },
    onError: (err) => {
      setError(err.message);
      toast.push({ kind: 'error', title: 'Update failed', message: err.message });
    },
  });

  const del = trpc.resources.deleteQaEnvironment.useMutation({
    onSuccess: () => {
      utils.resources.qaEnvironments.invalidate();
      toast.push({ kind: 'success', title: 'Environment removed' });
      onClose();
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Delete failed', message: err.message }),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (isEdit) {
      update.mutate({
        environmentId: existing!.id,
        name: name.trim(),
        branch: branch.trim() || null,
        description: description.trim() || null,
      });
    } else {
      create.mutate({
        name: name.trim(),
        branch: branch.trim() || undefined,
        description: description.trim() || undefined,
      });
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Remove ${existing.name}?`,
      message:
        existing.bookings.length > 0
          ? `This environment still has ${existing.bookings.length} booking${existing.bookings.length === 1 ? '' : 's'}. Close them first.`
          : 'This cannot be undone.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) del.mutate({ environmentId: existing.id });
  };

  const busy = create.isPending || update.isPending || del.isPending;

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="animate-modal-in relative w-full max-w-card overflow-hidden rounded-lg bg-surface-primary shadow-float">
        <header className="flex items-center justify-between border-b border-border p-5">
          <h2>{isEdit ? `Edit ${existing!.name}` : 'Add environment'}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. QA12"
              className="min-h-input w-full rounded border border-border bg-surface-primary px-3 font-mono text-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-tertiary">
              <span className="inline-flex items-center gap-1">
                <LinkIcon className="h-3 w-3" />
                KBE branch (one per environment)
              </span>
            </label>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="e.g. temp/qa12-config"
              className="min-h-input w-full rounded border border-border bg-surface-primary px-3 font-mono text-sm text-text-primary placeholder:text-text-tertiary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder='Short purpose, e.g. "Pre-prod mirror"'
              className="w-full rounded border border-border bg-surface-primary px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-2 text-xs text-danger-text">
              <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <div>
              {isEdit && canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="flex min-h-input items-center gap-1.5 rounded border border-border px-3 text-sm text-text-secondary hover:border-danger-text/30 hover:bg-danger-bg hover:text-danger-text disabled:opacity-60"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-input rounded px-3 text-base text-text-secondary hover:bg-surface-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {busy && <SpinnerIcon className="h-4 w-4" />}
                {isEdit ? 'Save changes' : 'Add environment'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
