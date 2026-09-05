import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function formatMoney(minor) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format((minor || 0) / 100);
}

function StatusPill({ state }) {
  return <span className={`pill pill-${state}`}>{state.replaceAll('_', ' ')}</span>;
}

export default function App() {
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadDashboard() {
    setLoading(true);
    try {
      const headers = { 'X-RazCodePay-Merchant-Id': 'demo-merchant' };
      const [summaryResponse, casesResponse] = await Promise.all([
        fetch(`${API}/recovery/summary`, { headers }),
        fetch(`${API}/recovery/cases`, { headers }),
      ]);

      if (!summaryResponse.ok || !casesResponse.ok) throw new Error('API unavailable');
      setSummary(await summaryResponse.json());
      setCases((await casesResponse.json()).cases);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function seedDemo() {
    setMessage('Seeding 60 synthetic recovery cases…');
    try {
      const response = await fetch(`${API}/demo/seed`, { method: 'POST' });
      if (!response.ok) throw new Error('Demo seed failed');
      await loadDashboard();
      setMessage('Demo batch ready. All numbers shown are synthetic test data.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function stopCase(id) {
    const response = await fetch(`${API}/recovery/cases/${id}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RazCodePay-Merchant-Id': 'demo-merchant' },
      body: JSON.stringify({ reason: 'merchant_demo_stop' }),
    });
    if (!response.ok) return;
    await loadDashboard();
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const funnel = useMemo(() => {
    const total = summary?.totalCases || 0;
    const recovered = cases.filter((item) => item.state === 'recovered').length;
    const stopped = cases.filter((item) => item.state === 'stopped').length;
    return { total, recovered, stopped, active: total - recovered - stopped };
  }, [cases, summary]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">RazCodePay</div>
          <div className="subtitle">AI Revenue Recovery Console · Track 03</div>
        </div>
        <div className="topbar-actions">
          <span className="mode-badge">TEST MODE</span>
          <button className="secondary-btn" onClick={loadDashboard}>Refresh</button>
          <button className="primary-btn" onClick={seedDemo}>Seed Demo Batch</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">Recovery intelligence</p>
            <h1>Recover more. Automate less recklessly.</h1>
            <p className="hero-copy">
              RazCodePay detects revenue at risk, ranks only policy-approved recovery actions,
              and stops when payment success or a merchant rule says to stop.
            </p>
          </div>
          <div className="hero-card">
            <span>Verified recovery source</span>
            <strong>Razorpay success events</strong>
            <small>AI recommendations never mark money as recovered.</small>
          </div>
        </section>

        {message && <div className="notice">{message}</div>}

        <section className="metrics-grid">
          <article className="metric-card"><span>Revenue at risk</span><strong>{formatMoney(summary?.revenueAtRisk)}</strong><small>eligible open value</small></article>
          <article className="metric-card"><span>Recovered revenue</span><strong>{formatMoney(summary?.recoveredRevenue)}</strong><small>verified provider success</small></article>
          <article className="metric-card"><span>Recovery rate</span><strong>{((summary?.recoveryRate || 0) * 100).toFixed(1)}%</strong><small>recovered cases / all cases</small></article>
          <article className="metric-card"><span>Active cases</span><strong>{summary?.openCases || 0}</strong><small>awaiting or planned work</small></article>
        </section>

        <section className="content-grid">
          <article className="panel wide-panel">
            <div className="panel-header">
              <div><h2>Recovery funnel</h2><p>Current synthetic demo cohort</p></div>
              <span className="cohort-count">{funnel.total} cases</span>
            </div>
            <div className="funnel">
              <div><span>All cases</span><strong>{funnel.total}</strong></div>
              <div><span>Active</span><strong>{funnel.active}</strong></div>
              <div><span>Recovered</span><strong>{funnel.recovered}</strong></div>
              <div><span>Stopped</span><strong>{funnel.stopped}</strong></div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header"><div><h2>Guardrails</h2><p>Deterministic controls</p></div></div>
            <div className="guardrails">
              <span>✓ Consent required</span>
              <span>✓ Quiet hours enforced</span>
              <span>✓ Max 2 attempts/case</span>
              <span>✓ Success closes automation</span>
              <span>✓ Human review for high-value cases</span>
            </div>
          </article>
        </section>

        <section className="panel case-panel">
          <div className="panel-header">
            <div><h2>Recovery cases</h2><p>Click a case to inspect its decision context.</p></div>
            <span className="muted">{loading ? 'Loading…' : `${cases.length} records`}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Case</th><th>Type</th><th>Amount</th><th>Risk</th><th>Recoverability</th><th>Status</th><th /></tr></thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.id} onClick={() => setSelectedCase(item)}>
                    <td><strong>{String(item.id).slice(-8)}</strong><small>{item.failureCode || 'no code'}</small></td>
                    <td>{item.type.replaceAll('_', ' ')}</td>
                    <td>{formatMoney(item.amountMinor)}</td>
                    <td>{item.riskScore == null ? '—' : `${(item.riskScore * 100).toFixed(0)}%`}</td>
                    <td>{item.recoverabilityScore == null ? '—' : `${(item.recoverabilityScore * 100).toFixed(0)}%`}</td>
                    <td><StatusPill state={item.state} /></td>
                    <td><button className="text-btn" onClick={(event) => { event.stopPropagation(); setSelectedCase(item); }}>Inspect</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selectedCase && (
          <div className="drawer-backdrop" onClick={() => setSelectedCase(null)}>
            <aside className="drawer" onClick={(event) => event.stopPropagation()}>
              <div className="drawer-header"><div><p className="eyebrow">Case detail</p><h2>{String(selectedCase.id).slice(-8)}</h2></div><button className="close-btn" onClick={() => setSelectedCase(null)}>×</button></div>
              <StatusPill state={selectedCase.state} />
              <div className="detail-grid">
                <div><span>Amount</span><strong>{formatMoney(selectedCase.amountMinor)}</strong></div>
                <div><span>Risk</span><strong>{((selectedCase.riskScore || 0) * 100).toFixed(0)}%</strong></div>
                <div><span>Recoverability</span><strong>{((selectedCase.recoverabilityScore || 0) * 100).toFixed(0)}%</strong></div>
                <div><span>Attempts</span><strong>{selectedCase.attempts?.length || 0}</strong></div>
              </div>
              <div className="explanation"><span>Decision explanation</span><p>{selectedCase.explanation || 'No decision explanation yet.'}</p></div>
              <div className="explanation"><span>Failure context</span><p>{selectedCase.failureDescription || 'No failure description available.'}</p></div>
              {!['recovered', 'stopped', 'expired'].includes(selectedCase.state) && (
                <button className="danger-btn" onClick={() => { stopCase(selectedCase.id); setSelectedCase(null); }}>Stop automation</button>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
