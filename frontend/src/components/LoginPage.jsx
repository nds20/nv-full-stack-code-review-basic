import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage({ onLogIn = async (creds) => console.log('log in', creds), onCreateAccount = () => console.log('create account'), onBack = () => console.log('back') }) {
  const { login, loading, error: authError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const idRef = useRef(null);
  const pwRef = useRef(null);

  useEffect(() => idRef.current?.focus(), []);

  const clearError = () => error && setError('');

  const handleSubmit = async () => {
    if (!identifier.trim()) {
      setError('Enter your email or username.');
      idRef.current?.focus();
      return;
    }
    if (!password) {
      setError('Enter your password.');
      pwRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      await onLogIn({ identifier: identifier.trim(), password });
    } catch (err) {
      setError(err?.message || 'Email, username or password is incorrect.');
      setPassword('');
      pwRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="lg-page">
      <style>{css}</style>
      <section className="lg-card" aria-labelledby="lg-title">
        <h1 id="lg-title" className="lg-title">Log In</h1>

        <label htmlFor="lg-id" className="lg-sr">
          Email or username
        </label>
        <input
          id="lg-id"
          ref={idRef}
          className="lg-input"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Email or Username"
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            clearError();
          }}
          onKeyDown={onKeyDown}
          aria-invalid={!!error}
        />

        <label htmlFor="lg-pw" className="lg-sr">
          Password
        </label>
        <input
          id="lg-pw"
          ref={pwRef}
          className="lg-input"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError();
          }}
          onKeyDown={onKeyDown}
          aria-invalid={!!error}
          aria-describedby={error ? 'lg-error' : undefined}
        />

        {error && (
          <p id="lg-error" className="lg-error" role="alert">
            {error}
          </p>
        )}

        <button className="lg-btn" onClick={handleSubmit} disabled={submitting || loading}>
          {submitting || loading ? 'Logging in...' : 'Log In'}
        </button>

        <button className="lg-link lg-link--first" onClick={onCreateAccount}>
          Create Account
        </button>
        <button className="lg-link" onClick={onBack}>
          Back
        </button>
      </section>
    </div>
  );
}

const css = `
.lg-page {
  min-height: 100vh; display: grid; place-items: center; padding: 24px;
  background: #000; color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
}
.lg-card {
  width: 100%; max-width: 405px; box-sizing: border-box;
  padding: 44px 26px 28px; text-align: center;
  display: flex; flex-direction: column; align-items: stretch;
  background: #0d0d0d; border: 1px solid #2e2e2e; border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0,0,0,.6);
}
.lg-title { margin: 0 0 28px; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.01em; }
.lg-input {
  width: 100%; box-sizing: border-box; height: 54px; padding: 0 16px; margin-bottom: 16px;
  font: inherit; font-size: 1.05rem; color: #fff;
  background: #0d0d0d; border: 1px solid #4a4a4a; border-radius: 6px; outline: none;
  transition: border-color .15s;
}
.lg-input::placeholder { color: #8a8a8a; }
.lg-input:focus { border-color: #2f7a35; box-shadow: 0 0 0 3px rgba(47,122,53,.35); }
.lg-input[aria-invalid="true"] { border-color: #d9534f; }
.lg-error { margin: -6px 0 4px; text-align: left; font-size: .875rem; color: #ff7b75; }
.lg-btn {
  width: 100%; height: 60px; margin-top: 8px;
  font: inherit; font-size: 1.2rem; font-weight: 600; color: #fff;
  background: #2b622f; border: 0; border-radius: 6px; cursor: pointer;
  transition: background .15s;
}
.lg-btn:hover:not(:disabled) { background: #33733a; }
.lg-btn:disabled { opacity: .7; cursor: default; }
.lg-btn:focus-visible, .lg-link:focus-visible { outline: 2px solid #6fbf73; outline-offset: 3px; }
.lg-link {
  align-self: center; margin-top: 14px; padding: 6px 12px;
  background: none; border: 0; cursor: pointer; border-radius: 4px;
  font: inherit; font-size: 1.05rem; color: #bdbdbd;
}
.lg-link--first { margin-top: 22px; }
.lg-link:hover { color: #fff; }
.lg-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
`;
