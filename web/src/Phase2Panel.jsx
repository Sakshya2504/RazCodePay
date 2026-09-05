import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';
const money = (minor = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(minor || 0) / 100);
const label = (value = '') => value.replaceAll('_', ' ');
const token = () => localStorage.getItem('razcodepay_token');

function Field({ label: title, value, onChange, type = 'number' }) {
  return <label className="phase2-field"><span>{title}</span><input type={type} value={value} onChange={(event) => onChange(type === 'number' ? Number(event.target.value) : event.target.value)} /></label>;
}

export default function Phase2Panel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('integration');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [integration, setIntegration] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [active, setActive] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [queue, setQueue] = useState(null);
  const [communications, setCommunications] = useState([]);

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    const currentToken = token();
    if (currentToken) headers.set('Authorization', `Bearer ${currentToken}`);
    const response = await fetch(`${API}${path}`, { ...options, headers });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Request failed (${response.status})`);
    return response.json();
  }

  async function refresh() {
    setBusy(true);
    try {
      const [connectionData, policyData, experimentData, metricsData, queueData] = await Promise.all([
        api('/integrations/razorpay'),
        api('/policy'),
        api('/phase2/experiments'),
        api('/phase2/experiments/metrics'),
        api('/phase2/queue'),
      ]);
      setIntegration(connectionData);
      setPolicy(policyData);
      setExperiments(experimentData.experiments || []);
      setActive(experimentData.active || null);
      setMetrics(metricsData.metrics || []);
      setQueue(queueData);
      setReady(true);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy() {
    setBusy(true);
    try { const result = await api('/policy', { method: 'PUT', body: JSON.stringify(policy) }); setPolicy(result.policy); setNotice('Merchant policy saved and will be applied to new evaluations and execution.'); }
    catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function connectRazorpay() {
    setBusy(true);
    try {
      const result = await api('/integrations/razorpay/oauth/start?mode=test');
      window.location.href = result.authorizationUrl;
    } catch (error) { setNotice(error.message); setBusy(false); }
  }

  async function experimentAction(id, action) {
    setBusy(true);
    try { await api(`/phase2/experiments/${id}/${action}`, { method: 'POST' }); await refresh(); setNotice(`Experiment ${action}ed.`); }
    catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function createExperiment() {
    setBusy(true);
    try {
      const result = await api('/phase2/experiments', { method: 'POST', body: JSON.stringify({ name: `Recovery email test ${new Date().toLocaleDateString('en-IN')}`, primaryMetric: 'recovered_amount', arms: [{ name: 'control', action: 'send_payment_reminder', allocation: 0.5 }, { name: 'payment_link', action: 'create_payment_link', allocation: 0.5 }] }) });
      setNotice(`Created ${result.experiment.name}. Start it when ready.`);
      await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function loadCommunications(caseId) {
    if (!caseId) return;
    try { const result = await api(`/phase2/cases/${caseId}/communications`); setCommunications(result.communications || []); }
    catch (error) { setNotice(error.message); }
  }

  useEffect(() => {
    const bootstrap = async () => {
      const demo = !token();
      if (!demo) { setReady(true); return; }
      try { await api('/health'); setReady(true); } catch { setReady(false); }
    };
    bootstrap();
  }, []);

  if (!ready) return null;

  return <>
    <button className="phase2-launcher" onClick={() => { setOpen(true); refresh(); }}>Phase 2B</button>
    {open && <div className="phase2-backdrop" onClick={() => setOpen(false)}>
      <section className="phase2-panel" onClick={(event) => event.stopPropagation()}>
        <header className="phase2-head"><div><span className="eyebrow">Production controls</span><h2>Phase 2B command center</h2><p>{notice || 'Integrations, policy, experiments and operational health.'}</p></div><button className="icon-btn" onClick={() => setOpen(false)}>×</button></header>
        <nav className="phase2-tabs">{[['integration','Razorpay'],['policy','Policy'],['experiments','Experiments'],['ops','Operations'],['comms','Communications']].map(([key, text]) => <button key={key} className={tab === key ? 'filter-active' : ''} onClick={() => setTab(key)}>{text}</button>)}</nav>

        {tab === 'integration' && <div className="phase2-grid"><article className="card"><div className="phase2-status"><span className={`live-dot ${integration?.connected ? 'api' : 'local'}`}><i />{integration?.connected ? 'CONNECTED' : integration?.demoMode ? 'DEMO MODE' : 'NOT CONNECTED'}</span></div><h3>Razorpay merchant connection</h3><p>OAuth is the preferred production path. API keys remain available as an explicit fallback for merchant-owned credentials.</p><div className="phase2-list"><div><span>Auth type</span><strong>{integration?.authType || '—'}</strong></div><div><span>Mode</span><strong>{integration?.mode || '—'}</strong></div><div><span>Account</span><strong>{integration?.accountId || '—'}</strong></div><div><span>Webhook secret</span><strong>{integration?.webhookConfigured ? 'configured' : 'not configured'}</strong></div></div><button className="primary-btn" onClick={connectRazorpay} disabled={busy || integration?.demoMode}>Connect with Razorpay OAuth</button></article><article className="card"><h3>Execution boundary</h3><div className="guardrail-cards"><div>AI proposes <b>→</b> policy decides</div><div>Payment Link creation <b>→</b> provider API</div><div>Email <b>→</b> SMTP + communication log</div><div>Recovery <b>→</b> verified Razorpay event</div></div></article></div>}

        {tab === 'policy' && policy && <div className="phase2-grid"><article className="card"><h3>Merchant recovery policy</h3><p>These controls are persisted per merchant and re-checked immediately before an action executes.</p><div className="phase2-form"><Field label="Recovery window (hours)" value={policy.recoveryWindowHours} onChange={(value) => setPolicy({ ...policy, recoveryWindowHours: value })} /><Field label="Quiet start hour" value={policy.quietHours.start} onChange={(value) => setPolicy({ ...policy, quietStartHour: value })} /><Field label="Quiet end hour" value={policy.quietHours.end} onChange={(value) => setPolicy({ ...policy, quietEndHour: value })} /><Field label="Max attempts / case" value={policy.maxAttemptsPerCase} onChange={(value) => setPolicy({ ...policy, maxAttemptsPerCase: value })} /><Field label="Auto-contact cap (minor)" value={policy.maxAutoContactMinor} onChange={(value) => setPolicy({ ...policy, maxAutoContactMinor: value })} /><Field label="Human approval above (minor)" value={policy.approvalRequiredAboveMinor} onChange={(value) => setPolicy({ ...policy, humanApprovalAboveMinor: value })} /></div><button className="primary-btn" onClick={savePolicy} disabled={busy}>Save policy</button></article><article className="card"><h3>Current boundaries</h3><div className="phase2-list"><div><span>Quiet hours</span><strong>{policy.quietHours.start}:00 → {policy.quietHours.end}:00</strong></div><div><span>Automatic contact</span><strong>{money(policy.maxAutoContactMinor)}</strong></div><div><span>Human approval</span><strong>{money(policy.approvalRequiredAboveMinor)}</strong></div><div><span>Attempts</span><strong>{policy.maxAttemptsPerCase}</strong></div></div></article></div>}

        {tab === 'experiments' && <div className="phase2-grid"><article className="card"><div className="card-title"><div><h2>Recovery experiments</h2><p>Deterministic treatment assignment with policy as the hard boundary.</p></div><button className="primary-btn" onClick={createExperiment} disabled={busy}>New experiment</button></div>{experiments.length === 0 ? <p className="muted">No experiments yet.</p> : experiments.map((experiment) => <div className="phase2-experiment" key={experiment.id}><div><strong>{experiment.name}</strong><span>{experiment.status} · {label(experiment.primaryMetric)}</span></div><div className="phase2-arms">{experiment.arms.map((arm) => <span key={arm.name}>{arm.name}: {label(arm.action)} · {Math.round(arm.allocation * 100)}%</span>)}</div><div>{experiment.status === 'draft' && <button className="secondary-btn" onClick={() => experimentAction(experiment.id, 'start')}>Start</button>}{experiment.status === 'running' && <button className="danger-btn" onClick={() => experimentAction(experiment.id, 'stop')}>Stop</button>}</div></div>)}</article><article className="card"><h3>Results</h3>{metrics.length ? <div className="phase2-metrics">{metrics.map((item) => <div key={`${item._id?.experimentId}-${item._id?.arm}`}><strong>{item._id?.arm}</strong><span>{item.cases} cases · {item.recovered} recovered</span><em>{money(item.recoveredAmountMinor)}</em></div>)}</div> : <p className="muted">Run a recovery experiment to populate verified outcome metrics.</p>}{active && <p className="muted">Active: <strong>{active.name}</strong></p>}</article></div>}

        {tab === 'ops' && <div className="phase2-grid"><article className="card"><h3>Queue health</h3><div className="metric-grid"><div className="metric"><span>Enabled</span><strong>{queue?.enabled ? 'YES' : 'NO'}</strong><small>{queue?.enabled ? 'Redis/BullMQ active' : 'Synchronous/demo mode'}</small></div><div className="metric"><span>Waiting</span><strong>{queue?.waiting || 0}</strong><small>scheduled work</small></div><div className="metric"><span>Active</span><strong>{queue?.active || 0}</strong><small>worker concurrency</small></div><div className="metric"><span>Failed</span><strong>{queue?.failed || 0}</strong><small>needs operator review</small></div></div></article><article className="card"><h3>Operational contract</h3><div className="guardrail-cards"><div>Webhook dedupe <b>→</b> deterministic event key</div><div>Retries <b>→</b> exponential backoff</div><div>Action idempotency <b>→</b> case + sequence hash</div><div>Provider truth <b>→</b> recovery close</div></div></article></div>}

        {tab === 'comms' && <div className="phase2-grid"><article className="card"><h3>Communication audit</h3><p>Enter a recovery case id to inspect outbound communication events.</p><div className="phase2-inline"><input id="phase2-case-id" placeholder="case id" /><button className="secondary-btn" onClick={() => loadCommunications(document.getElementById('phase2-case-id')?.value)}>Load</button></div>{communications.length ? communications.map((event) => <div className="phase2-event" key={event.id}><strong>{event.channel}</strong><span>{event.status}</span><small>{event.template || '—'} · {event.providerReference || '—'}</small></div>) : <p className="muted">No communication records loaded.</p>}</article></div>}
      </section>
    </div>}
  </>;
}
