'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowRight, Database, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FplDashboard } from '@/components/fpl-dashboard';
import type { DashboardData } from '@/lib/fpl-types';

const STORAGE_KEY = 'fpl_manager_id';

export default function Home() {
  const [managerId, setManagerId] = useState('');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadManager = useCallback(async (id: string): Promise<DashboardData | null> => {
    if (!/^\d+$/.test(id)) {
      setError('Enter a valid numeric FPL Manager ID.');
      return null;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/fpl/dashboard?id=${encodeURIComponent(id)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'We could not load that manager.');
      const nextDashboard = payload as DashboardData;
      setDashboard(nextDashboard);
      window.localStorage.setItem(STORAGE_KEY, id);
      return nextDashboard;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'FPL is temporarily unavailable.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedId = window.localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      setManagerId(savedId);
      void loadManager(savedId);
    }
  }, [loadManager]);

  useEffect(() => {
    type ModelContext = {
      registerTool: (tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => Promise<unknown>;
      }, options: { signal: AbortSignal }) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'connect_fpl_manager',
      title: 'Connect FPL manager',
      description: 'Validate a public FPL Manager ID, load its dashboard, and remember it on this device.',
      inputSchema: {
        type: 'object',
        properties: { managerId: { oneOf: [{ type: 'string', pattern: '^\\d+$' }, { type: 'integer', minimum: 1 }] } },
        required: ['managerId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        const managerId = String((input as { managerId?: string | number })?.managerId ?? '').trim();
        if (!/^\d+$/.test(managerId)) throw new Error('managerId must contain digits only.');
        const result = await loadManager(managerId);
        if (!result) throw new Error('The manager could not be loaded.');
        return { managerId: result.manager.id, teamName: result.manager.name, status: 'connected' };
      },
    }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, [loadManager]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadManager(managerId.trim());
  }

  function switchManager() {
    window.localStorage.removeItem(STORAGE_KEY);
    setDashboard(null);
    setManagerId('');
    setError('');
  }

  if (dashboard) {
    return <FplDashboard data={dashboard} onRefresh={() => loadManager(String(dashboard.manager.id))} onSwitchManager={switchManager} refreshing={loading} />;
  }

  return (
    <main className="connect-screen">
      <header className="connect-header">
        <div aria-label="App name reserved" className="brand-reserved" />
        <span className="source-status"><span /> Public FPL data</span>
      </header>
      <section className="connect-workspace">
        <div className="connect-index">
          <span className="index-number">01</span>
          <div>
            <p className="eyebrow">Manager connection</p>
            <h1>Bring your team into focus.</h1>
            <p className="connect-copy">One manager ID unlocks your published squad, rank history, live points and decision models.</p>
          </div>
          <div className="connection-notes">
            <span><ShieldCheck /> Read-only public data</span>
            <span><Database /> Saved on this device</span>
          </div>
        </div>
        <div className="connect-form-wrap">
          <div className="form-rule"><span>FPL</span><span>2026/27</span></div>
          <form onSubmit={submit}>
            <label htmlFor="manager-id">FPL Manager ID</label>
            <div className="manager-input-row">
              <Input autoFocus autoComplete="off" id="manager-id" inputMode="numeric" onChange={(event) => setManagerId(event.target.value)} placeholder="e.g. 908661" value={managerId} />
              <Button aria-label="Connect manager" disabled={loading} size="icon-lg" type="submit">
                {loading ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
              </Button>
            </div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <p className="form-help">Find the number in your FPL team URL after <strong>/entry/</strong>.</p>
          </form>
        </div>
      </section>
    </main>
  );
}
