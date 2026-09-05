import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate.jsx';
import Phase2Panel from './Phase2Panel.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import './styles.css';
import './ui-upgrade.css';

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const token = localStorage.getItem('razcodepay_token');
  if (!token || !url.includes('/api/')) return nativeFetch(input, init);
  const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return nativeFetch(input, { ...init, headers });
};

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div className="fatal"><div><span className="eyebrow">Console error</span><h1>The recovery console could not render.</h1><p>{this.state.error.message}</p><button className="primary-btn" onClick={() => window.location.reload()}>Reload console</button></div></div>;
    return this.props.children;
  }
}

function Root() {
  return <React.StrictMode><ErrorBoundary><AuthGate /><Phase2Panel /><ProfileMenu /></ErrorBoundary></React.StrictMode>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
