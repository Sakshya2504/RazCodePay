import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';
const OPEN_STATES = new Set(['detected', 'enriched', 'awaiting_window', 'planned', 'executing', 'monitoring']);

function money(minor = 0) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);
}
function pct(value = 0) { return `${Math.round(value * 100)}%`; }
function label(value = '') { return value.replaceAll('_', ' '); }
function timeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}

const fallbackCases = Array.from({ length: 8 }, (_, i) => ({
  id: `demo-${String(i + 1).padStart(3, '0')}`,
  type: ['failed_subscription', 'invoice_overdue', 'checkout_abandonment'][i % 3],
  state: i === 0 || i === 3 ? 'recovered' : i === 6 ? 'stopped' : 'planned',
  amountMinor: [249900, 499900, 129900, 799900, 199900, 349900, 899900, 159900][i],
  currency: 'INR', customerId: `cust_${i + 1}`,
  failureCode: ['PAYMENT_FAILED', 'CUSTOMER_ACTION_REQUIRED', 'NETWORK_ERROR', 'GATEWAY_ERROR'][i % 4],
  failureDescription: i % 2 ? 'Customer action is required before the payment can complete.' : 'Payment failed but the customer remains a plausible recovery candidate.',
  riskScore: [0.72, 0.48, 0.63, 0.81, 0.55, 0.68, 0.91, 0.44][i],
  recoverabilityScore: [0.84, 0.62, 0.71, 0.89, 0.66, 0.76, 0.21, 0.58][i],
  attemptCount: i === 0 ? 1 : 0,
  attempts: i === 0 ? [{ action: 'send_payment_reminder', channel: 'email', status: 'sent_test_mode' }] : [],
  ai: { source: 'local-model', modelVersion: 'local-recovery-v1', recommendation: i === 6 ? 'create_human_task' : 'send_payment_reminder', confidence: [0.91, 0.86, 0.8, 0.93, 0.78, 0.88, 0.96, 0.82][i], reasonCodes: i === 6 ? ['high_amount', 'low_recoverability', 'human_review_boundary'] : ['fresh_event', 'recoverable_failure', 'consent_available'], explanation: i === 6 ? 'High value plus low recoverability crosses the human-review boundary.' : 'Fresh failure + recoverable signal + consent make a reminder a reasonable next action.' },
  openedAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
  recoveredAmountMinor: i === 0 || i === 3 ? [249900, 799900][i === 0 ? 0 : 1] : 0,
  nextActionAt: new Date(Date.now() + 30 * 60000).toISOString(),
}));

function fallbackSummary(items) {
  const active = items.filter((item) => OPEN_STATES.has(item.state));
  const recovered = items.filter((item) => item.state === 'recovered');
  return {
    totalCases: items.length,
    activeCases: active.length,
    recoveredCases: recovered.length,
    stoppedCases: items.filter((item) => item.state === 'stopped').length,
    revenueAtRiskMinor: active.reduce((sum, item) => sum + item.amountMinor, 0),
    recoveredRevenueMinor: items.reduce((sum, item) => sum + (item.recoveredAmountMinor || 0), 0),
    recoveryRate: items.length ? recovered.length / items.length : 0,
    attempts: items.reduce((sum, item) => sum + (item.attemptCount || 0), 0),
    estimatedHoursSaved: 2.8,
  };
}

function Status({ state }) { return <span className={`status status-${state}`}>{label(state)}</span>; }
function SignalBar({ value, positive = true }) { return <div className="signal-track"><span className={`signal-fill ${positive ? 'positive' : 'negative'}`} style={{ width: `${Math.round(value * 100)}%` }} /></div>; }

export default function App() {
  const [cases, setCases] = useState([]);
  const [summary, setSummary] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [connection, setConnection] = useState('connecting');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', 'X-RazCodePay-Merchant-Id': 'demo-merchant', ...(options.headers || {}) } });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Request failed (${response.status})`);
    return response.json();
  }

  async function load() {
    setBusy(true);
    try {
      const data = await api('/dashboard');
      setCases(data.cases);
      setSummary(data.summary);
      setPolicy(data.policy);
      setConnection('api');
      setNotice('Live demo API connected · synthetic merchant data');
    } catch {
      setCases(fallbackCases);
      setSummary(fallbackSummary(fallbackCases));
      setConnection('local');
      setNotice('API unavailable · local safe-mode data is active');
    } finally { setBusy(false); }
  }

  async function resetDemo() {
    setBusy(true);
    try {
      await api('/demo/reset', { method: 'POST' });
      await load();
      setNotice('60-case synthetic cohort loaded');
    } catch {
      setCases(fallbackCases);
      setSummary(fallbackSummary(fallbackCases));
      setConnection('local');
      setNotice('Local safe-mode cohort restored');
    } finally { setBusy(false); }
  }

  async function inspect(item) {
    setSelected({ ...item, loadingAi: true });
    try {
      if (connection === 'api') {
        const data = await api(`/cases/${item.id}/evaluate`, { method: 'POST' });
        setSelected(data.case);
        setCases((current) => current.map((row) => row.id === item.id ? data.case : row));
        setSummary(data.summary);
      } else setSelected({ ...item, loadingAi: false });
    } catch (error) {
      setSelected({ ...item, loadingAi: false, aiError: error.message });
    }
  }

  async function execute(caseId) {
    setBusy(true);
    try {
      if (connection === 'api') {
        const data = await api(`/cases/${caseId}/execute`, { method: 'POST' });
        setSelected(data.case);
        setCases((current) => current.map((row) => row.id === caseId ? data.case : row));
        const dashboard = await api('/dashboard');
        setSummary(dashboard.summary);
        setNotice('Test-mode reminder recorded · waiting for verified provider success');
      } else {
        const updated = cases.map((row) => row.id === caseId ? { ...row, state: 'monitoring', attemptCount: (row.attemptCount || 0) + 1, attempts: [...(row.attempts || []), { action: 'send_payment_reminder', channel: 'email', status: 'sent_test_mode' }] } : row);
        setCases(updated); setSummary(fallbackSummary(updated));
        setSelected(updated.find((row) => row.id === caseId));
        setNotice('Local test-mode reminder recorded');
      }
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function stop(caseId) {
    try {
      if (connection === 'api') await api(`/cases/${caseId}/stop`, { method: 'POST', body: JSON.stringify({ reason: 'merchant_demo_stop' }) });
      const updated = cases.map((row) => row.id === caseId ? { ...row, state: 'stopped', nextActionAt: null, stopReason: 'merchant_demo_stop' } : row);
      setCases(updated); setSummary(fallbackSummary(updated)); setSelected(updated.find((row) => row.id === caseId)); setNotice('Automation stopped by merchant');
    } catch (error) { setNotice(error.message); }
  }

  useEffect(() => { load(); }, []);

  const visibleCases = useMemo(() => filter === 'all' ? cases : cases.filter((item) => item.state === filter || item.type === filter), [cases, filter]);
  const activeValue = summary?.revenueAtRiskMinor || 0;
  const recoveredValue = summary?.recoveredRevenueMinor || 0;
  const aiReady = cases.filter((item) => item.ai?.recommendation).length;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark">R</div><div><div className="brand">RazCodePay</div><div className="muted">AI Revenue Recovery · Razorpay Track 03</div></div></div>
        <div className="top-actions"><span className="test-chip">TEST MODE</span><span className={`live-dot ${connection}`}><i />{connection === 'api' ? 'API CONNECTED' : connection === 'local' ? 'SAFE MODE' : 'CONNECTING'}</span><button className="icon-btn" onClick={load} disabled={busy}>↻</button></div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav>
            <button className={view === 'overview' ? 'nav-active' : ''} onClick={() => setView('overview')}><span>◈</span>Overview</button>
            <button className={view === 'queue' ? 'nav-active' : ''} onClick={() => setView('queue')}><span>⌁</span>Recovery queue</button>
            <button className={view === 'ai' ? 'nav-active' : ''} onClick={() => setView('ai')}><span>✦</span>AI decisions</button>
            <button className={view === 'policy' ? 'nav-active' : ''} onClick={() => setView('policy')}><span>◍</span>Guardrails</button>
          </nav>
          <div className="side-card"><span className="eyebrow">Demo control</span><strong>60-case synthetic cohort</strong><p>No live customer money is touched. Provider success alone closes a case.</p><button className="secondary-btn full" onClick={resetDemo} disabled={busy}>Reset demo cohort</button></div>
        </aside>

        <main className="main">
          <div className="page-head"><div><span className="eyebrow">Merchant command center</span><h1>{view === 'overview' ? 'Revenue recovery, with brakes.' : view === 'queue' ? 'Recovery queue' : view === 'ai' ? 'AI decision studio' : 'Deterministic guardrails'}</h1><p>{notice || 'Detect → diagnose → decide → act → verify.'}</p></div><div className="safe-banner"><span>✓</span><div><strong>Money recovered only from provider confirmation</strong><small>AI recommends. Policy permits. Executor acts. Razorpay verifies.</small></div></div></div>

          {view === 'overview' && <>
            <section className="metric-grid">
              <Metric title="Revenue at risk" value={money(activeValue)} sub="open eligible value" icon="◎" />
              <Metric title="Recovered" value={money(recoveredValue)} sub={`${pct(summary?.recoveryRate)} case recovery rate`} icon="↗" highlight />
              <Metric title="Active cases" value={String(summary?.activeCases || 0)} sub={`${aiReady} AI-scored decisions`} icon="◇" />
              <Metric title="Operator time saved" value={`${summary?.estimatedHoursSaved || 0}h`} sub="estimated from automation" icon="◷" />
            </section>
            <section className="grid-2">
              <article className="card"><CardTitle title="Recovery funnel" caption="Synthetic cohort status" /><div className="funnel-grid"><Funnel label="At risk" value={summary?.totalCases || 0} /><Funnel label="Active" value={summary?.activeCases || 0} /><Funnel label="Recovered" value={summary?.recoveredCases || 0} /><Funnel label="Stopped" value={summary?.stoppedCases || 0} /></div></article>
              <article className="card"><CardTitle title="AI operating principle" caption="Bounded autonomy" /><div className="principle"><div><b>1</b><span>Policy pre-filter</span><small>Removes actions the AI is never allowed to choose.</small></div><div><b>2</b><span>AI ranking</span><small>Scores recovery potential and proposes one allowed action.</small></div><div><b>3</b><span>Policy post-filter</span><small>Execution re-checks caps, consent, quiet hours and state.</small></div></div></article>
            </section>
          </>}

          {view === 'policy' && <PolicyPanel policy={policy} />}
          {view === 'ai' && <AiStudio cases={cases} onInspect={inspect} />}
          {view === 'queue' && <>
            <div className="toolbar"><div className="filters">{['all', 'planned', 'monitoring', 'recovered', 'stopped', 'failed_subscription', 'invoice_overdue'].map((item) => <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)}>{label(item)}</button>)}</div></div>
            <CaseTable items={visibleCases} onInspect={inspect} />
          </>}

          {view === 'overview' && <section className="card"><CardTitle title="Highest-priority recovery cases" caption="Ranked for operator inspection" action={<button className="text-btn" onClick={() => setView('queue')}>Open queue →</button>} /><CaseTable items={[...cases].sort((a, b) => (b.amountMinor * (b.recoverabilityScore || 0)) - (a.amountMinor * (a.recoverabilityScore || 0))).slice(0, 6)} onInspect={inspect} /></section>}
        </main>
      </div>

      {selected && <div className="drawer-bg" onClick={() => setSelected(null)}><aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-top"><div><span className="eyebrow">Recovery case</span><h2>{selected.id}</h2></div><button className="icon-btn" onClick={() => setSelected(null)}>×</button></div>
        <div className="drawer-status"><Status state={selected.state} /><span>{label(selected.type)}</span><strong>{money(selected.amountMinor)}</strong></div>
        <div className="score-grid"><Score label="Recoverability" value={selected.recoverabilityScore || 0} /><Score label="Risk" value={selected.riskScore || 0} /></div>
        <div className="ai-card"><div className="ai-head"><span>✦ AI recommendation</span><span className="ai-source">{selected.ai?.source || 'local-model'}</span></div>{selected.loadingAi ? <div className="loading-line">Analysing recovery signals…</div> : <><h3>{label(selected.ai?.recommendation || 'wait')}</h3><p>{selected.ai?.explanation || selected.failureDescription}</p><div className="confidence">Confidence <strong>{pct(selected.ai?.confidence || 0)}</strong></div><div className="reason-list">{(selected.ai?.reasonCodes || []).map((reason) => <span key={reason}>{reason.replaceAll('_', ' ')}</span>)}</div></>}</div>
        <div className="context"><span>Failure context</span><strong>{selected.failureCode || '—'}</strong><p>{selected.failureDescription || 'No provider failure description.'}</p></div>
        <div className="attempts"><span>Execution history</span>{selected.attempts?.length ? selected.attempts.map((attempt, index) => <div className="attempt" key={`${attempt.idempotencyKey || index}`}><span>{attempt.action.replaceAll('_', ' ')}</span><small>{attempt.status} · {attempt.channel || 'internal'}</small></div>) : <p>No outbound attempt yet.</p>}</div>
        <div className="drawer-actions">{OPEN_STATES.has(selected.state) && selected.ai?.recommendation === 'send_payment_reminder' && <button className="primary-btn full" onClick={() => execute(selected.id)} disabled={busy}>Run test-mode reminder</button>}{OPEN_STATES.has(selected.state) && <button className="danger-btn full" onClick={() => stop(selected.id)}>Stop automation</button>}</div>
      </aside></div>}
    </div>
  );
}

function Metric({ title, value, sub, icon, highlight }) { return <article className={`metric ${highlight ? 'metric-highlight' : ''}`}><span className="metric-icon">{icon}</span><span>{title}</span><strong>{value}</strong><small>{sub}</small></article>; }
function CardTitle({ title, caption, action }) { return <div className="card-title"><div><h2>{title}</h2><p>{caption}</p></div>{action}</div>; }
function Funnel({ label: text, value }) { return <div className="funnel"><span>{text}</span><strong>{value}</strong><div className="funnel-bar"><i style={{ width: `${Math.min(100, value * 10 + 12)}%` }} /></div></div>; }
function Score({ label: text, value }) { return <div className="score"><div><span>{text}</span><strong>{pct(value)}</strong></div><SignalBar value={value} /></div>; }
function PolicyPanel({ policy }) { return <div className="grid-2"><article className="card"><CardTitle title="Automation guardrails" caption="Deterministic policy, not an AI opinion" />{policy && <div className="policy-list"><PolicyRow title="Quiet hours" value={`${policy.quietHours.start}:00 → ${policy.quietHours.end}:00`} /><PolicyRow title="Max attempts / case" value={policy.maxAttemptsPerCase} /><PolicyRow title="Auto-contact cap" value={money(policy.maxAutoContactMinor)} /><PolicyRow title="Human approval above" value={money(policy.approvalRequiredAboveMinor)} /><PolicyRow title="Allowed channel" value={policy.channels.email ? 'Email' : 'None'} /></div>}</article><article className="card"><CardTitle title="Fail-safe rules" caption="What AI cannot override" /><div className="guardrail-cards"><div>Consent missing <b>→</b> no customer contact</div><div>Quiet hours <b>→</b> wait</div><div>High value <b>→</b> human review</div><div>Success event <b>→</b> close case</div><div>Duplicate event <b>→</b> idempotent no-op</div><div>Unverified webhook <b>→</b> reject</div></div></article></div>; }
function PolicyRow({ title, value }) { return <div className="policy-row"><span>{title}</span><strong>{value}</strong></div>; }
function AiStudio({ cases, onInspect }) { const ranked = [...cases].sort((a, b) => ((b.recoverabilityScore || 0) * b.amountMinor) - ((a.recoverabilityScore || 0) * a.amountMinor)); return <div className="grid-2"><article className="card"><CardTitle title="AI-ranked opportunities" caption="Value × predicted recoverability" /><div className="ranking">{ranked.slice(0, 8).map((item, idx) => <button className="rank-row" key={item.id} onClick={() => onInspect(item)}><b>0{idx + 1}</b><div><strong>{item.id}</strong><span>{label(item.type)} · {item.failureCode}</span></div><em>{money(Math.round(item.amountMinor * (item.recoverabilityScore || 0)))} expected value</em></button>)}</div></article><article className="card"><CardTitle title="Model signals" caption="Interpretable local recovery model" /><div className="model-note"><strong>local-recovery-v1</strong><p>No API key required. The local model combines failure recoverability, event freshness, customer intent, consent and prior-attempt pressure. An LLM can add reasoning, but can never bypass the allow-list.</p></div><div className="legend"><span><i className="dot positive-dot" />positive signal</span><span><i className="dot negative-dot" />negative signal</span></div></article></div>; }
function CaseTable({ items, onInspect }) { return <div className="table-wrap"><table><thead><tr><th>Case</th><th>Type</th><th>Amount</th><th>AI</th><th>Recoverability</th><th>Status</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.id}</strong><small>{item.failureCode || 'provider event'}</small></td><td>{label(item.type)}</td><td>{money(item.amountMinor)}</td><td><span className="ai-action">✦ {label(item.ai?.recommendation || 'analyse')}</span></td><td><div className="mini-score"><span>{pct(item.recoverabilityScore || 0)}</span><SignalBar value={item.recoverabilityScore || 0} /></div></td><td><Status state={item.state} /></td><td><button className="text-btn" onClick={() => onInspect(item)}>Inspect</button></td></tr>)}</tbody></table></div>; }
