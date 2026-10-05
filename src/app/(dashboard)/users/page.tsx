'use client';

import clsx from 'clsx';
import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { Briefcase, Check, ClipboardList, Eye, EyeOff, LockKeyhole, Mail, Plus, UserRound, Wrench, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { controlClass, Field, FormAlert } from '@/components/ui/Field';
import { Modal, ModalIcon } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { ApiError, api } from '@/lib/api';
import { ASSIGNABLE_ROLES, roleLabel } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import type { User } from '@/types';

const ROLE_CHOICES: { value: (typeof ASSIGNABLE_ROLES)[number]['value']; hint: string; icon: LucideIcon }[] = [
  { value: 'executive', hint: 'Plans and reviews', icon: Briefcase },
  { value: 'operation', hint: 'Runs the floor', icon: ClipboardList },
  { value: 'engineering', hint: 'Sets up plant', icon: Wrench },
];

const loadUsers = () => api<User[]>('/users', { live: true });

export default function UsersPage() {
  const { data, error, isLoading, mutate } = useSWR('users', loadUsers);
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts that can sign in to TWCS"
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
              </tr>
            </thead>
            <tbody>
              {data.map((user) => (
                <tr key={user.id}>
                  <td className="font-mono text-xs">{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{roleLabel(user.role)}</td>
                  <td className="tabular-nums text-slate-400">{user.createdAt ? fmtDateTime(user.createdAt) : '—'}</td>
                  <td className="tabular-nums text-slate-400">{user.updatedAt ? fmtDateTime(user.updatedAt) : '—'}</td>
                </tr>
              ))}
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
