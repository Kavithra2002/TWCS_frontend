'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormAlert } from '@/components/ui/Field';
import { Modal, ModalIcon } from '@/components/ui/Modal';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel = 'Working…',
  danger = false,
  icon,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel?: string;
  danger?: boolean;
  icon?: ReactNode;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError('');
  }, [open]);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      icon={
        icon ?? (
          <ModalIcon
            icon={danger ? TriangleAlert : CheckCircle2}
            tone={danger ? 'danger' : 'tea'}
          />
        )
      }
      onClose={busy ? () => undefined : onClose}
      panelClassName="max-w-md"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} type="button" onClick={() => void confirm()} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
    </Modal>
  );
}
