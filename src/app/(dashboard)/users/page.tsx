'use client';

import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { ApiError, api } from '@/lib/api';
import { roleLabel } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import type { User } from '@/types';

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

    setSaving(true);
    try {
      await api('/users', {
        method: 'POST',
        live: true,
        json: { name: name.trim(), email: email.trim(), password, role: 'super_admin' },
      });
      setName('');
      setEmail('');
      setPassword('');
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
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-user" disabled={saving}>
            {saving ? 'Saving…' : 'Create user'}
          </Button>
        </>
      }
    >
      <form id="create-user" className="space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-400">Name</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-400">Email</span>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-400">Password</span>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        </label>
        <p className="text-xs text-slate-500">New accounts are created as super admin.</p>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </form>
    </Modal>
  );
}
