import { useState, useRef, useEffect } from 'react';
import { adminLogin, fetchSetupStatus, setupAdmin } from '../../services/adminApi';

export default function AdminLogin({ onSuccess = () => {}, onBack = () => {} }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const userRef = useRef(null);

  // First-run setup state: whether the server still needs its first admin
  // account, and whether the demo login is currently accepted.
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState('login'); // 'login' | 'setup'
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupError, setSetupError] = useState('');

  useEffect(() => userRef.current?.focus(), []);

  useEffect(() => {
    let cancelled = false;
    fetchSetupStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { /* server unreachable — the plain login form still works */ });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setError('Enter the admin username and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await adminLogin(username.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetup = async () => {
    if (newUsername.trim().length < 3) {
      setSetupError('Choose a username of at least 3 characters.');
      return;
    }
    if (newPassword.length < 8) {
      setSetupError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSetupError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setSetupError('');
    try {
      await setupAdmin(newUsername.trim(), newPassword);
      onSuccess();
    } catch (err) {
      setSetupError(err.message || 'Could not create the admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const onSetupKeyDown = (e) => {
    if (e.key === 'Enter') handleSetup();
  };

  return (
    <div className="ad-page">
      <style>{css}</style>
      <section className="ad-card" aria-labelledby="ad-title">
        <h1 id="ad-title" className="ad-title">Store Admin</h1>
        <p className="ad-sub">
          {mode === 'setup' ? 'Create the first admin account for this shop.' : 'Sign in to manage products and orders.'}
        </p>

        {mode === 'login' && (
          <>
            <label htmlFor="ad-user" className="ad-sr">Admin username</label>
            <input
              id="ad-user"
              ref={userRef}
              className="ad-input"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Admin username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={onKeyDown}
            />

            <label htmlFor="ad-pw" className="ad-sr">Admin password</label>
            <input
              id="ad-pw"
              className="ad-input"
              type="password"
              autoComplete="current-password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown}
              aria-invalid={!!error}
              aria-describedby={error ? 'ad-error' : undefined}
            />

            {error && (
              <p id="ad-error" className="ad-error" role="alert">{error}</p>
            )}

            <button className="ad-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>

            {status && status.dummyActive && (
              <p className="ad-demo">
                Demo mode: no admin account exists yet, so the built-in demo
                login works — username <strong>admin</strong>, password{' '}
                <strong>admin123</strong>. It stops working the moment a real
                account is created.
              </p>
            )}

            {status && status.setupRequired && (
              <button
                className="ad-link"
                onClick={() => { setMode('setup'); setError(''); }}
              >
                Create admin account
              </button>
            )}
          </>
        )}

        {mode === 'setup' && (
          <>
            <label htmlFor="ad-new-user" className="ad-sr">New admin username</label>
            <input
              id="ad-new-user"
              className="ad-input"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Choose a username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={onSetupKeyDown}
            />

            <label htmlFor="ad-new-pw" className="ad-sr">New admin password</label>
            <input
              id="ad-new-pw"
              className="ad-input"
              type="password"
              autoComplete="new-password"
              placeholder="New password (8+ characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={onSetupKeyDown}
            />

            <label htmlFor="ad-confirm-pw" className="ad-sr">Confirm password</label>
            <input
              id="ad-confirm-pw"
              className="ad-input"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={onSetupKeyDown}
              aria-invalid={!!setupError}
              aria-describedby={setupError ? 'ad-setup-error' : undefined}
            />

            {setupError && (
              <p id="ad-setup-error" className="ad-error" role="alert">{setupError}</p>
            )}

            <button className="ad-btn" onClick={handleSetup} disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create account & sign in'}
            </button>
            <button
              className="ad-link"
              onClick={() => { setMode('login'); setSetupError(''); }}
            >
              Back to sign in
            </button>

            <p className="ad-note">
              One-time setup: this creates the shop's first admin account.
              The password is stored on the server only as a scrypt hash, and
              creating the account disables the demo login.
            </p>
          </>
        )}

        <button className="ad-link" onClick={onBack}>Back to shop</button>

        {mode === 'login' && (
          <p className="ad-note">
            Sign in with an account created here, or with the
            SMOKESHOP_ADMIN_USER / SMOKESHOP_ADMIN_PASSWORD environment
            variables configured on the server. Passwords are never stored
            in this app.
          </p>
        )}
      </section>
    </div>
  );
}

const css = `
.ad-page {
  min-height: 100vh; display: grid; place-items: center; padding: 24px;
  background: #000; color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
}
.ad-card {
  width: 100%; max-width: 405px; box-sizing: border-box;
  padding: 44px 26px 28px; text-align: center;
  display: flex; flex-direction: column; align-items: stretch;
  background: #0d0d0d; border: 1px solid #2e2e2e; border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0,0,0,.6);
}
.ad-title { margin: 0 0 8px; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.01em; }
.ad-sub { margin: 0 0 28px; color: #bdbdbd; }
.ad-input {
  width: 100%; box-sizing: border-box; height: 54px; padding: 0 16px; margin-bottom: 16px;
  font: inherit; font-size: 1.05rem; color: #fff;
  background: #0d0d0d; border: 1px solid #4a4a4a; border-radius: 6px; outline: none;
  transition: border-color .15s;
}
.ad-input::placeholder { color: #8a8a8a; }
.ad-input:focus { border-color: #2f7a35; box-shadow: 0 0 0 3px rgba(47,122,53,.35); }
.ad-input[aria-invalid="true"] { border-color: #d9534f; }
.ad-error { margin: -6px 0 4px; text-align: left; font-size: .875rem; color: #ff7b75; }
.ad-btn {
  width: 100%; height: 60px; margin-top: 8px;
  font: inherit; font-size: 1.2rem; font-weight: 600; color: #fff;
  background: #2b622f; border: 0; border-radius: 6px; cursor: pointer;
  transition: background .15s;
}
.ad-btn:hover:not(:disabled) { background: #33733a; }
.ad-btn:disabled { opacity: .7; cursor: default; }
.ad-btn:focus-visible, .ad-link:focus-visible { outline: 2px solid #6fbf73; outline-offset: 3px; }
.ad-link {
  align-self: center; margin-top: 16px; padding: 6px 12px;
  background: none; border: 0; cursor: pointer; border-radius: 4px;
  font: inherit; font-size: 1.05rem; color: #bdbdbd;
}
.ad-link:hover { color: #fff; }
.ad-note { margin: 22px 0 0; font-size: .8rem; line-height: 1.45; color: #8a8a8a; text-align: left; }
.ad-demo {
  margin: 18px 0 0; padding: 12px 14px; text-align: left;
  font-size: .85rem; line-height: 1.5; color: #ffd98a;
  background: rgba(245, 185, 33, .08); border: 1px solid #8a6d1f; border-radius: 6px;
}
.ad-demo strong { color: #ffe1a1; }
.ad-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
`;
