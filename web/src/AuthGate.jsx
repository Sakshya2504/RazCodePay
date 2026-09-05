import { useEffect, useState } from 'react';
import App from './App.jsx';
import './auth.css';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';

function AuthGate() {
  const [mode, setMode] = useState('checking');
  const [formMode, setFormMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', merchantName: '' });
  const [integration, setIntegration] = useState({ keyId: '', keySecret: '', webhookSecret: '', mode: 'test' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function checkProductionSession(token) {
    const response = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) { localStorage.removeItem('razcodepay_token'); setMode('auth'); return; }
    const connection = await fetch(`${API}/integrations/razorpay`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await connection.json().catch(() => ({}));
    setMode(data.connected ? 'ready' : 'connect');
  }

  useEffect(() => {
    const token = localStorage.getItem('razcodepay_token');
    fetch(`${API}/health`).then((response) => response.json()).then(async (health) => {
      if (health.mode !== 'production-mongodb') { setMode('ready'); return; }
      if (!token) { setMode('auth'); return; }
      await checkProductionSession(token);
    }).catch(() => setMode('ready'));
  }, []);

  async function submitAuth(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const endpoint = formMode === 'login' ? '/auth/login' : '/auth/register';
      const response = await fetch(`${API}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed.');
      localStorage.setItem('razcodepay_token', data.token);
      const connection = await fetch(`${API}/integrations/razorpay`);
      const status = await connection.json();
      setMode(status.connected ? 'ready' : 'connect');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function connectRazorpay(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/integrations/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(integration) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Razorpay connection failed.');
      setMode('ready');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (mode === 'checking') return <div className="auth-screen"><div className="auth-card"><div className="auth-mark">R</div><h1>RazCodePay</h1><p>Checking deployment mode…</p></div></div>;
  if (mode === 'ready') return <App />;

  if (mode === 'connect') return <div className="auth-screen"><form className="auth-card" onSubmit={connectRazorpay}>
    <div className="auth-mark">R</div><span className="auth-eyebrow">Razorpay integration</span><h1>Connect your merchant account</h1>
    <p className="auth-copy">Use Razorpay Test Mode first. Credentials are verified against Razorpay and the secret values are encrypted before MongoDB storage.</p>
    <input placeholder="Razorpay Key ID" value={integration.keyId} onChange={(e) => setIntegration({ ...integration, keyId: e.target.value })} required />
    <input type="password" placeholder="Razorpay Key Secret" value={integration.keySecret} onChange={(e) => setIntegration({ ...integration, keySecret: e.target.value })} required />
    <input type="password" placeholder="Webhook Secret" value={integration.webhookSecret} onChange={(e) => setIntegration({ ...integration, webhookSecret: e.target.value })} />
    <select value={integration.mode} onChange={(e) => setIntegration({ ...integration, mode: e.target.value })}><option value="test">Test Mode</option><option value="live">Live Mode</option></select>
    {error && <div className="auth-error">{error}</div>}
    <button className="auth-submit" disabled={busy}>{busy ? 'Verifying with Razorpay…' : 'Connect Razorpay'}</button>
    <button type="button" className="auth-toggle" onClick={() => { localStorage.removeItem('razcodepay_token'); setMode('auth'); }}>Use a different account</button>
  </form></div>;

  return <div className="auth-screen"><form className="auth-card" onSubmit={submitAuth}>
    <div className="auth-mark">R</div><span className="auth-eyebrow">Merchant command center</span><h1>{formMode === 'login' ? 'Welcome back' : 'Create your merchant account'}</h1>
    <p className="auth-copy">Production mode uses MongoDB-backed authentication. Your browser receives a short-lived access token; provider secrets stay encrypted server-side.</p>
    {formMode === 'register' && <input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
    {formMode === 'register' && <input placeholder="Merchant / company name" value={form.merchantName} onChange={(e) => setForm({ ...form, merchantName: e.target.value })} required />}
    <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
    <input type="password" placeholder="Password (10+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} />
    {error && <div className="auth-error">{error}</div>}
    <button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : formMode === 'login' ? 'Sign in' : 'Create account'}</button>
    <button type="button" className="auth-toggle" onClick={() => { setFormMode(formMode === 'login' ? 'register' : 'login'); setError(''); }}>{formMode === 'login' ? 'Create a new merchant account' : 'I already have an account'}</button>
  </form></div>;
}

export default AuthGate;
