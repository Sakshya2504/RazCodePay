import { useEffect, useRef, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';

function initials(user) {
  const source = user?.name || user?.merchantName || user?.email || 'M';
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'M';
}

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [integration, setIntegration] = useState(null);
  const ref = useRef(null);
  const authenticated = Boolean(localStorage.getItem('razcodepay_token'));

  useEffect(() => {
    const load = async () => {
      try {
        const requests = [fetch(`${API}/integrations/razorpay`)];
        if (authenticated) requests.unshift(fetch(`${API}/auth/me`));
        const responses = await Promise.all(requests);
        const meResponse = authenticated ? responses[0] : null;
        const integrationResponse = authenticated ? responses[1] : responses[0];
        if (meResponse?.ok) setUser(await meResponse.json());
        if (integrationResponse?.ok) setIntegration(await integrationResponse.json());
      } catch {
        // Keep the profile control usable even when status lookup is unavailable.
      }
    };
    load();
  }, [authenticated]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const account = user?.user || user || {};
  const name = account.name || account.fullName || account.merchantName || (authenticated ? 'Merchant account' : 'Demo Merchant');
  const email = account.email || account.contactEmail || (authenticated ? 'Signed-in merchant' : 'demo@razcodepay.local');
  const merchant = account.merchantName || account.merchant?.name || (authenticated ? 'RazCodePay merchant' : 'RazCodePay Demo Workspace');
  const connected = Boolean(integration?.connected);

  function logout() {
    localStorage.removeItem('razcodepay_token');
    localStorage.removeItem('razcodepay_session');
    window.location.assign(window.location.pathname);
  }

  return <div className="profile-menu" ref={ref}>
    <button className="profile-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Open merchant profile menu">
      <span className="profile-avatar">{initials(account)}</span>
      <span className="profile-trigger-copy"><strong>{name}</strong><small>{authenticated ? 'Merchant account' : 'Demo workspace'}</small></span>
      <span className={`profile-caret ${open ? 'profile-caret-open' : ''}`}>⌄</span>
    </button>

    {open && <div className="profile-popover">
      <div className="profile-summary">
        <div className="profile-avatar profile-avatar-large">{initials(account)}</div>
        <div><strong>{name}</strong><span>{email}</span><small>{merchant}</small></div>
      </div>

      <div className="profile-status-row">
        <span className={`profile-status-dot ${connected ? 'connected' : ''}`} />
        <div><strong>{connected ? 'Razorpay connected' : 'Razorpay integration status'}</strong><small>{connected ? 'Test Mode integration active' : 'Connect from Operations'}</small></div>
      </div>

      <div className="profile-section-label">ACCOUNT</div>
      <div className="profile-item"><span>◉</span><div><strong>Profile</strong><small>Merchant identity and account access</small></div></div>
      <div className="profile-item"><span>▣</span><div><strong>Security</strong><small>{authenticated ? 'Authenticated session and protected credentials' : 'Demo workspace with no merchant credentials'}</small></div></div>

      <button className="profile-logout" onClick={logout}><span>↪</span><div><strong>{authenticated ? 'Sign out' : 'Exit demo'}</strong><small>{authenticated ? 'End this merchant session' : 'Return to the application entry screen'}</small></div></button>
    </div>}
  </div>;
}
