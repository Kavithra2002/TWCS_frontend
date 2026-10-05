'use client';

import clsx from 'clsx';
import { AlignLeft, Hash, Monitor, PanelsTopLeft, Plus, Trash2, Type, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlClass, Field, FormAlert } from '@/components/ui/Field';
import { Modal, ModalIcon } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { ApiError, api } from '@/lib/api';
import type { MasterScreen, User } from '@/types';

const loadScreens = () => api<MasterScreen[]>('/master-data/screens', { live: true });
const loadUsers = () => api<User[]>('/users', { live: true });

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

function suggestCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function assignedScreenIds(screens: MasterScreen[], userId: string) {
  return screens.filter((screen) => screen.assignedUsers.some((user) => user.id === userId)).map((screen) => screen.id);
}

function sameIds(left: string[], right: string[]) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export default function MasterDataPage() {
  const { data: screens, error: screensError, isLoading: screensLoading, mutate } = useSWR('master-screens', loadScreens);
  const { data: users, error: usersError, isLoading: usersLoading } = useSWR('users', loadUsers);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [screenOpen, setScreenOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [assignMessage, setAssignMessage] = useState('');
  const [assignError, setAssignError] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    run: () => Promise<void>;
  } | null>(null);

  const selected = screens?.find((screen) => screen.id === selectedId) ?? (selectedId ? null : (screens?.[0] ?? null));
  const savedIds = screens && userId ? assignedScreenIds(screens, userId) : [];
  const assignmentDirty = Boolean(userId) && !sameIds(picked, savedIds);

  useEffect(() => {
    if (!users?.length || !screens || userId) return;
    const id = users[0].id;
    setUserId(id);
    setPicked(assignedScreenIds(screens, id));
  }, [users, screens, userId]);

  function chooseUser(id: string) {
    setUserId(id);
    setAssignMessage('');
    setAssignError('');
    setPicked(assignedScreenIds(screens ?? [], id));
  }

  function toggleScreen(id: string) {
    setAssignMessage('');
    setAssignError('');
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function removeScreen(screen: MasterScreen) {
    setConfirm({
      title: 'Delete screen',
      description: `"${screen.name}" and its views and assignments will be removed.`,
      confirmLabel: 'Delete screen',
      run: async () => {
        setActionError('');
        try {
          await api(`/master-data/screens/${screen.id}`, { method: 'DELETE', live: true });
          if (selected?.id === screen.id) setSelectedId(null);
          setPicked((current) => current.filter((id) => id !== screen.id));
          await mutate();
        } catch (err) {
          const message = err instanceof ApiError ? err.message : 'Could not delete the screen.';
          setActionError(message);
          throw new Error(message);
        }
      },
    });
  }

  function removeView(screen: MasterScreen, viewId: string, viewName: string) {
    setConfirm({
      title: 'Delete view',
      description: `"${viewName}" will be removed from ${screen.name}.`,
      confirmLabel: 'Delete view',
      run: async () => {
        setActionError('');
        try {
          await api(`/master-data/screens/${screen.id}/views/${viewId}`, { method: 'DELETE', live: true });
          await mutate();
        } catch (err) {
          const message = err instanceof ApiError ? err.message : 'Could not delete the view.';
          setActionError(message);
          throw new Error(message);
        }
      },
    });
  }

  async function saveAssignment() {
    if (!userId) return;
    setSavingAssign(true);
    setAssignError('');
    setAssignMessage('');
    try {
      const next = await api<MasterScreen[]>(`/master-data/users/${userId}/screens`, {
        method: 'PUT',
        live: true,
        json: { screenIds: picked },
      });
      await mutate(next, { revalidate: false });
      setAssignMessage('Assigned screens saved.');
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : 'Could not save the assignment.');
    } finally {
      setSavingAssign(false);
    }
  }

  const loadError = screensError ?? usersError;

  return (
    <>
      <PageHeader
        title="Master Data Dev"
        description="Create screens, add the views inside each screen, and assign screens to users."
        actions={
          <Button onClick={() => setScreenOpen(true)}>
            <Plus className="h-4 w-4" />
            Create screen
          </Button>
        }
      />

      {loadError ? (
        <ErrorState error={loadError} />
      ) : screensLoading || usersLoading || !screens || !users ? (
        <Loading label="Loading master data…" />
      ) : (
        <div className="space-y-4">
          {actionError && <ErrorState error={new Error(actionError)} />}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Screens" subtitle="Select a screen to manage the views inside it">
              {screens.length === 0 ? (
                <EmptyState title="No screens yet" hint="Create a screen, then add views to it." />
              ) : (
                <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
                  {screens.map((screen) => {
                    const active = selected?.id === screen.id;
                    return (
                      <li key={screen.id}>
                        <div
                          className={clsx(
                            'flex items-start gap-2 rounded-lg border px-3 py-2.5',
                            active ? 'border-tea-600/40 bg-tea-600/10' : 'border-slate-800 hover:bg-slate-800/40',
                          )}
                        >
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(screen.id)}>
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-slate-100">{screen.name}</span>
                              <span className="shrink-0 font-mono text-[11px] text-slate-500">{screen.code}</span>
                            </span>
                            {screen.description && <span className="mt-1 block truncate text-xs text-slate-400">{screen.description}</span>}
                            <span className="mt-1 block truncate text-xs text-slate-500">
                              {screen.views.length} {screen.views.length === 1 ? 'view' : 'views'}
                              {' · '}
                              {screen.assignedUsers.length
                                ? `Assigned to ${screen.assignedUsers.map((user) => user.name).join(', ')}`
                                : 'Not assigned'}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-300"
                            aria-label={`Delete ${screen.name}`}
                            onClick={() => void removeScreen(screen)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card
              title="Views"
              subtitle={selected ? `Inside ${selected.name}` : 'Views belong to a screen'}
              action={
                selected ? (
                  <Button size="sm" onClick={() => setViewOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add view
                  </Button>
                ) : undefined
              }
            >
              {!selected ? (
                <EmptyState title="No screen selected" hint="Create a screen to add views." />
              ) : selected.views.length === 0 ? (
                <EmptyState title="No views in this screen" hint="Add the first view for this screen." />
              ) : (
                <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
                  {selected.views.map((view) => (
                    <li key={view.id} className="flex items-start gap-2 rounded-lg border border-slate-800 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-100">{view.name}</p>
                          <span className="shrink-0 font-mono text-[11px] text-slate-500">{view.code}</span>
                        </div>
                        {view.description && <p className="mt-1 truncate text-xs text-slate-400">{view.description}</p>}
                      </div>
                      <button
                        type="button"
                        className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-300"
                        aria-label={`Delete ${view.name}`}
                        onClick={() => void removeView(selected, view.id, view.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card
            title="Assign screens"
            subtitle="Choose a user, tick the screens they should have, then save"
            action={
              <Button size="sm" onClick={() => void saveAssignment()} disabled={!assignmentDirty || savingAssign || screens.length === 0}>
                {savingAssign ? 'Saving…' : 'Save assigned screens'}
              </Button>
            }
          >
            {users.length === 0 ? (
              <EmptyState title="No users yet" hint="Add a user before assigning screens." />
            ) : screens.length === 0 ? (
              <EmptyState title="No screens to assign" hint="Create a screen first." />
            ) : (
              <div className="space-y-3">
                <label className="block max-w-sm text-sm">
                  <span className="label">User</span>
                  <select className="input" value={userId} onChange={(event) => chooseUser(event.target.value)}>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </label>
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {screens.map((screen) => (
                    <li key={screen.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 px-3 py-2.5 hover:bg-slate-800/40">
                        <input
                          type="checkbox"
                          className="mt-1 accent-teal-500"
                          checked={picked.includes(screen.id)}
                          onChange={() => toggleScreen(screen.id)}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-slate-100">{screen.name}</span>
                          <span className="block truncate font-mono text-[11px] text-slate-500">
                            {screen.code}
                            {screen.views.length ? ` · ${screen.views.length} ${screen.views.length === 1 ? 'view' : 'views'}` : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {assignMessage && <p className="text-sm text-emerald-300">{assignMessage}</p>}
                {assignError && <p className="text-sm text-red-300">{assignError}</p>}
              </div>
            )}
          </Card>
        </div>
      )}

      <RecordModal
        open={screenOpen}
        title="Create screen"
        description="Name the screen and give it a short code."
        icon={Monitor}
        submitLabel="Save screen"
        onClose={() => setScreenOpen(false)}
        onSubmit={async (input) => {
          const created = await api<MasterScreen>('/master-data/screens', { method: 'POST', live: true, json: input });
          const next = [...(screens ?? []).filter((screen) => screen.id !== created.id), created].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
          setSelectedId(created.id);
          setScreenOpen(false);
          await mutate(next, { revalidate: true });
        }}
      />

      <RecordModal
        open={viewOpen}
        title={selected ? `Add view to ${selected.name}` : 'Add view'}
        description="Add a view inside this screen."
        icon={PanelsTopLeft}
        submitLabel="Add view"
        onClose={() => setViewOpen(false)}
        onSubmit={async (input) => {
          if (!selected) return;
          const updated = await api<MasterScreen>(`/master-data/screens/${selected.id}/views`, {
            method: 'POST',
            live: true,
            json: input,
          });
          setSelectedId(updated.id);
          setViewOpen(false);
          await mutate(
            (screens ?? []).map((screen) => (screen.id === updated.id ? updated : screen)),
            { revalidate: true },
          );
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmLabel={confirm?.confirmLabel ?? 'Confirm'}
        danger
        onConfirm={() => confirm?.run() ?? Promise.resolve()}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function RecordModal({
  open,
  title,
  description: hint,
  icon,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  icon: LucideIcon;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (input: { name: string; code: string; description: string }) => Promise<void>;
}) {
  const formId = useId();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setCode('');
    setDescription('');
    setCodeTouched(false);
    setError('');
    setSaving(false);
  }, [open]);

  async function onFormSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (trimmedName.length < 2) {
      setError('Enter a name of at least 2 characters.');
      return;
    }
    if (!CODE_PATTERN.test(trimmedCode)) {
      setError('Enter a code using letters, numbers, hyphens, or underscores.');
      return;
    }
    if (description.trim().length > 240) {
      setError('Description must be 240 characters or fewer.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({ name: trimmedName, code: trimmedCode, description: description.trim() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      description={hint}
      icon={<ModalIcon icon={icon} />}
      onClose={onClose}
      panelClassName="max-w-md"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} className="space-y-3.5" onSubmit={onFormSubmit}>
        <Field label="Name" icon={Type}>
          <input
            className={controlClass({ icon: true })}
            value={name}
            onChange={(event) => {
              const next = event.target.value;
              setName(next);
              if (!codeTouched) setCode(suggestCode(next));
            }}
            placeholder="Withering overview"
            autoComplete="off"
          />
        </Field>
        <Field label="Code" icon={Hash}>
          <input
            className={clsx(controlClass({ icon: true }), 'font-mono uppercase')}
            value={code}
            onChange={(event) => {
              setCodeTouched(true);
              setCode(event.target.value.toUpperCase());
            }}
            placeholder="WITHERING_OVERVIEW"
            autoComplete="off"
          />
        </Field>
        <Field label="Description" icon={AlignLeft} iconAlign="top">
          <textarea
            className={controlClass({ icon: true, area: true })}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this is for"
          />
        </Field>
        {error && <FormAlert>{error}</FormAlert>}
      </form>
    </Modal>
  );
}
