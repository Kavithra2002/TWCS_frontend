'use client';

import clsx from 'clsx';
import { useEffect, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Minus,
  Plus,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlClass, Field, FormAlert } from '@/components/ui/Field';
import { Modal, ModalIcon } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError, api } from '@/lib/api';
import {
  ASSIGNABLE_ROLES,
  canManageUsers,
  executiveDesignationLabel,
  roleLabel,
} from '@/lib/auth';
import { fmtDateTime, fmtTroughCode } from '@/lib/format';
import type { ExecutiveConfig, ExecutiveDesignation, Trough, User } from '@/types';

const ROLE_CHOICES: { value: (typeof ASSIGNABLE_ROLES)[number]['value']; hint: string; icon: LucideIcon }[] = [
  { value: 'executive', hint: 'Plans and reviews', icon: Briefcase },
  { value: 'operation', hint: 'Runs the floor', icon: ClipboardList },
  { value: 'engineering', hint: 'Sets up plant', icon: Wrench },
];

const DEFAULT_EXECUTIVE_CONFIG: ExecutiveConfig = {
  designation: 'standard',
  troughIds: [],
  canViewLiveMonitoring: true,
  canExportReports: false,
  receiveAlertDigest: true,
  notes: '',
};

const loadUsers = () => api<User[]>('/users', { live: true });
/** Must be live — save validates trough IDs against the real API, not demo store. */
const loadTroughs = () => api<Trough[]>('/troughs', { live: true });

export default function UsersPage() {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useSWR(canManageUsers(user) ? 'users' : null, loadUsers);
  const { data: troughs } = useSWR(canManageUsers(user) ? 'troughs-basic' : null, loadTroughs);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!canManageUsers(user)) {
    return (
      <EmptyState
        title="Users is for Super admin only"
        hint="Only a Super admin can create Executive, Operation, and Engineering accounts."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Create Executive, Operation, and Engineering sign-ins"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        }
      />

      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !data ? (
        <Loading label="Loading users…" />
      ) : data.length === 0 ? (
        <EmptyState title="No users yet" hint="Add the first account to sign in." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <table className="table-base">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Updated</th>
                <th className="w-[1%] text-right">Setup</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const isExecutive = row.role === 'executive';
                const expanded = expandedId === row.id;
                const designation = row.executiveConfig?.designation;
                return (
                  <UserRows
                    key={row.id}
                    user={row}
                    isExecutive={isExecutive}
                    expanded={expanded}
                    designation={designation}
                    troughs={troughs ?? []}
                    onToggle={() => setExpandedId(expanded ? null : row.id)}
                    onSaved={() => void mutate()}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          void mutate();
        }}
      />
    </>
  );
}

function UserRows({
  user,
  isExecutive,
  expanded,
  designation,
  troughs,
  onToggle,
  onSaved,
}: {
  user: User;
  isExecutive: boolean;
  expanded: boolean;
  designation?: ExecutiveDesignation;
  troughs: Trough[];
  onToggle: () => void;
  onSaved: () => void;
}) {
  return (
    <>
      <tr className={clsx(expanded && 'bg-tea-600/[0.06]')}>
        <td className="font-mono text-xs">{user.id}</td>
        <td>{user.name}</td>
        <td>{user.email}</td>
        <td>
          <div className="flex flex-wrap items-center gap-1.5">
            <span>{roleLabel(user.role)}</span>
            {isExecutive && designation === 'general_manager' && (
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                GM
              </span>
            )}
          </div>
        </td>
        <td className="tabular-nums text-slate-400">{user.createdAt ? fmtDateTime(user.createdAt) : '—'}</td>
        <td className="tabular-nums text-slate-400">{user.updatedAt ? fmtDateTime(user.updatedAt) : '—'}</td>
        <td className="text-right">
          {isExecutive ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse executive settings' : 'Open executive setup'}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
                expanded
                  ? 'bg-tea-700 text-white shadow-sm shadow-tea-900/40 hover:bg-tea-600'
                  : 'bg-tea-600 text-white shadow-md shadow-tea-600/30 hover:bg-tea-500 hover:shadow-lg hover:shadow-tea-500/35 active:scale-[0.98]',
              )}
            >
              {expanded ? <Minus className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
              <span>{expanded ? 'Close' : 'Setup'}</span>
            </button>
          ) : (
            <span className="text-xs text-slate-600">—</span>
          )}
        </td>
      </tr>
      {isExecutive && expanded && (
        <tr className="bg-slate-950/70">
          <td colSpan={7} className="!p-0">
            <ExecutiveConfigPanel user={user} troughs={troughs} onSaved={onSaved} onCollapse={onToggle} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExecutiveConfigPanel({
  user,
  troughs,
  onSaved,
  onCollapse,
}: {
  user: User;
  troughs: Trough[];
  onSaved: () => void;
  onCollapse: () => void;
}) {
  const initial = user.executiveConfig ?? DEFAULT_EXECUTIVE_CONFIG;
  const [designation, setDesignation] = useState<ExecutiveDesignation>(initial.designation);
  const [troughIds, setTroughIds] = useState<string[]>(initial.troughIds ?? []);
  const [canViewLiveMonitoring, setCanViewLiveMonitoring] = useState(initial.canViewLiveMonitoring);
  const [canExportReports, setCanExportReports] = useState(initial.canExportReports);
  const [receiveAlertDigest, setReceiveAlertDigest] = useState(initial.receiveAlertDigest);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const next = user.executiveConfig ?? DEFAULT_EXECUTIVE_CONFIG;
    const known = new Set(troughs.map((t) => t.id));
    setDesignation(next.designation);
    // Drop stale demo / deleted IDs so save only sends troughs that exist in the API.
    setTroughIds((next.troughIds ?? []).filter((id) => known.has(id)));
    setCanViewLiveMonitoring(next.canViewLiveMonitoring);
    setCanExportReports(next.canExportReports);
    setReceiveAlertDigest(next.receiveAlertDigest);
    setNotes(next.notes ?? '');
    setError('');
    setConfirmOpen(false);
  }, [user, troughs]);

  function toggleTrough(id: string) {
    setTroughIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const knownIds = new Set(troughs.map((t) => t.id));
  const validTroughIds = troughIds.filter((id) => knownIds.has(id));
  const isGm = designation === 'general_manager';

  function requestSave() {
    setError('');
    if (isGm && validTroughIds.length === 0) {
      setError('Assign at least one trough for a General manager.');
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmSave() {
    const executiveConfig: ExecutiveConfig = {
      designation,
      troughIds: isGm ? validTroughIds : [],
      canViewLiveMonitoring,
      canExportReports,
      receiveAlertDigest,
      notes: notes.trim() || null,
    };
    try {
      await api(`/users/${user.id}`, {
        method: 'PATCH',
        live: true,
        json: { executiveConfig },
      });
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : 'Could not save executive settings.');
    }
    onSaved();
    onCollapse();
  }

  const confirmDescription = isGm
    ? `Save ${executiveDesignationLabel(designation)} settings for ${user.name} with ${validTroughIds.length} assigned trough${validTroughIds.length === 1 ? '' : 's'}? The setup panel will close after saving.`
    : `Save ${executiveDesignationLabel(designation)} settings for ${user.name}? The setup panel will close after saving.`;

  return (
    <div className="border-t border-slate-800 px-4 py-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">Executive setup · {user.name}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Role stays Executive. Choose Normal executive or General manager, then assign troughs and extras.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" type="button" onClick={onCollapse}>
            Cancel
          </Button>
          <Button type="button" onClick={requestSave}>
            Save executive setup
          </Button>
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Collapse
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Save executive setup?"
        description={confirmDescription}
        confirmLabel="Save setup"
        busyLabel="Saving…"
        onConfirm={confirmSave}
        onClose={() => setConfirmOpen(false)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Designation</h3>
          <div className="mt-2 grid gap-2">
            {(
              [
                { value: 'standard' as const, title: 'Normal executive', hint: 'Factory-wide executive access' },
                {
                  value: 'general_manager' as const,
                  title: 'General manager',
                  hint: 'Still Executive role · limited to assigned troughs',
                },
              ] as const
            ).map((option) => {
              const selected = designation === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDesignation(option.value)}
                  className={clsx(
                    'rounded-lg border px-3 py-2.5 text-left transition',
                    selected
                      ? 'border-tea-500 bg-tea-600/10 ring-1 ring-tea-500'
                      : 'border-slate-700 bg-slate-950 hover:border-slate-500',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-100">{option.title}</span>
                    {selected ? (
                      <Check className="h-3.5 w-3.5 text-tea-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">{option.hint}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Current: {executiveDesignationLabel(designation)}
          </p>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assigned troughs</h3>
            <span className="text-[11px] text-slate-500">
              {isGm ? `${troughIds.length} selected` : 'Only for General manager'}
            </span>
          </div>
          {!isGm ? (
            <p className="mt-3 text-sm text-slate-500">
              Switch to General manager to pick which troughs this person can view.
            </p>
          ) : troughs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No troughs available yet.</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {troughs.map((trough) => {
                const selected = troughIds.includes(trough.id);
                return (
                  <label
                    key={trough.id}
                    className={clsx(
                      'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition',
                      selected
                        ? 'border-tea-500/70 bg-tea-600/10'
                        : 'border-slate-700 bg-slate-950 hover:border-slate-500',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleTrough(trough.id)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-100">{fmtTroughCode(trough.code)}</span>
                      <span className="block truncate text-[11px] text-slate-400">{trough.name}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 lg:col-span-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Other configuration</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <ToggleRow
              label="Live monitoring"
              hint="Allow this executive to open live trough views later"
              checked={canViewLiveMonitoring}
              onChange={setCanViewLiveMonitoring}
            />
            <ToggleRow
              label="Export reports"
              hint="Permit CSV / report downloads when reports open for this role"
              checked={canExportReports}
              onChange={setCanExportReports}
            />
            <ToggleRow
              label="Alert digest"
              hint="Include this account in daily open-alert summaries"
              checked={receiveAlertDigest}
              onChange={setReceiveAlertDigest}
            />
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-[13px] font-medium text-slate-300">Notes for Super admin</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. Covers lines A–C · night shift coverage"
              className={clsx(controlClass(), 'min-h-[64px] resize-y')}
            />
          </div>
        </section>
      </div>

      {error && (
        <div className="mt-3">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600"
      />
      <span>
        <span className="block text-sm font-medium text-slate-100">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{hint}</span>
      </span>
    </label>
  );
}

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError('Enter the user name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!ASSIGNABLE_ROLES.some((item) => item.value === role)) {
      setError('Select a role.');
      return;
    }

    setSaving(true);
    try {
      await api('/users', {
        method: 'POST',
        live: true,
        json: { name: name.trim(), email: email.trim(), password, role },
      });
      setName('');
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setRole('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Add user"
      description="Create a sign-in and choose a role."
      icon={<ModalIcon icon={Plus} />}
      onClose={onClose}
      panelClassName="max-w-md"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-user" disabled={saving}>
            {saving ? 'Saving…' : 'Create user'}
          </Button>
        </>
      }
    >
      <form id="create-user" className="space-y-3.5" onSubmit={onSubmit}>
        <Field label="Name" icon={UserRound}>
          <input
            className={controlClass({ icon: true })}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
            autoComplete="name"
          />
        </Field>
        <Field label="Email" icon={Mail}>
          <input
            className={controlClass({ icon: true })}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@factory.com"
            autoComplete="off"
          />
        </Field>
        <Field label="Password" icon={LockKeyhole}>
          <input
            className={clsx(controlClass({ icon: true }), 'pr-11')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-200"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Field>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-slate-300">Role</legend>
          <div className="grid grid-cols-3 gap-2">
            {ROLE_CHOICES.map((item) => {
              const selected = role === item.value;
              const label = ASSIGNABLE_ROLES.find((roleItem) => roleItem.value === item.value)?.label ?? item.value;
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setRole(item.value)}
                  className={clsx(
                    'relative flex min-h-[92px] flex-col items-start gap-2 rounded-xl border px-2.5 py-2.5 text-left transition',
                    selected
                      ? 'border-tea-500 bg-tea-600/10 ring-1 ring-tea-500'
                      : 'border-slate-700 bg-slate-950 hover:border-slate-500',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      selected ? 'bg-tea-600 text-white' : 'bg-slate-800 text-slate-300',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-tight text-slate-100">{label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{item.hint}</span>
                  </span>
                  {selected && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-tea-600 text-white">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && <FormAlert>{error}</FormAlert>}
      </form>
    </Modal>
  );
}
