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

  useEffect(() => {
    if (!localStorage.getItem('razcodepay_token')) return undefined;
    const load = async () => {
      try {
        const [meResponse, integrationResponse] = await Promise.all([
          fetch(`${API}/auth/me`),
          fetch(`${API}/integrations/razorpay`),
        ]);
        if (meResponse.ok) setUser(await meResponse.json());
        if (integrationResponse.ok) setIntegration(await integrationResponse.json());
      } catch {
        // The profile remains usable even if the status lookup is unavailable.
      }
    };
    load();
    return undefined;
  }, []);

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

  if (!localStorage.getItem('razcodepay_token')) return null;

  const account = user?.user || user || {};
  const name = account.name || account.fullName || account.merchantName || 'Merchant account';
  const email = account.email || account.contactEmail || 'Signed-in merchant';
  const merchant = account.merchantName || account.merchant?.name || 'RazCodePay merchant';
  const connected = Boolean(integration?.connected);

  function logout() {
    localStorage.removeItem('razcodepay_token');
    localStorage.removeItem('razcodepay_session');
    window.location.assign(window.location.pathname);
  }

  return <div className="profile-menu" ref={ref}>
    <button className="profile-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Open profile menu">
      <span className="profile-avatar">{initials(account)}</span>
      <span className="profile-trigger-copy"><strong>{name}</strong><small>Merchant account</small></span>
      <span className={`profile-caret ${open ? 'profile-caret-open' : ''}`}>⌄</span>
    </button>

    {open && <div className="profile-popover">
      <div className="profile-summary">
        <div className="profile-avatar profile-avatar-large">{initials(account)}</div>
        <div><strong>{name}</strong><span>{email}</span><small>{merchant}</small></div>
      </div>

      <div className="profile-status-row">
        <span className={`profile-status-dot ${connected ? 'connected' : ''}`} />
        <div><strong>{connected ? 'Razorpay connected' : 'Razorpay not connected'}</strong><small>{connected ? 'Test Mode integration active' : 'Connect from Operations'}</small></div>
      </div>

      <div className="profile-section-label">ACCOUNT</div>
      <div className="profile-item"><span>◉</span><div><strong>Profile</strong><small>Merchant identity and account access</small></div></div>
      <div className="profile-item"><span>▣</span><div><strong>Security</strong><small>Authenticated session and protected credentials</small></div></div>

      <button className="profile-logout" onClick={logout}><span>↪</span><div><strong>Sign out</strong><small>End this merchant session</small></div></button>
    </div>}
  </div>;
}
