import { useEffect, useState } from 'react';
import App from './App.jsx';
import './auth.css';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';

function AuthGate() {
  const [mode, setMode] = useState('checking');
  const [formMode, setFormMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', merchantName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('razcodepay_token');
    fetch(`${API}/health`).then((response) => response.json()).then((health) => {
      if (health.mode !== 'production-mongodb') return setMode('ready');
      if (!token) return setMode('auth');
      return fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => {
        if (!response.ok) localStorage.removeItem('razcodepay_token');
        setMode(response.ok ? 'ready' : 'auth');
      });
    }).catch(() => setMode('ready'));
  }, []);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const endpoint = formMode === 'login' ? '/auth/login' : '/auth/register';
      const response = await fetch(`${API}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed.');
      localStorage.setItem('razcodepay_token', data.token);
      setMode('ready');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (mode === 'checking') return <div className="auth-screen"><div className="auth-card"><div className="auth-mark">R</div><h1>RazCodePay</h1><p>Checking deployment mode…</p></div></div>;
  if (mode === 'ready') return <App />;

  return <div className="auth-screen"><form className="auth-card" onSubmit={submit}>
    <div className="auth-mark">R</div><span className="auth-eyebrow">Merchant command center</span><h1>{formMode === 'login' ? 'Welcome back' : 'Create your merchant account'}</h1><p className="auth-copy">Production mode uses MongoDB-backed authentication. Your browser receives a short-lived access token; provider secrets are encrypted server-side.</p>
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
