import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

// Create-account form — the customer counterpart of LoginPage, sharing
// its card design. Registration is REAL: it posts to
// POST /api/customers/register via AuthContext.signup. Nothing is saved
// client-side; if the API is unreachable the form says so and no
// account is created.
export default function SignupPage({
  onSignUp = (profile) => console.log('signed up', profile),
  onLogIn = () => console.log('log in'),
  onBack = () => console.log('back'),
}) {
  const { signup, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => nameRef.current?.focus(), []);

  const clearError = () => error && setError('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const profile = await signup(name.trim(), email.trim(), password);
      setCreated(profile);
    } catch (err) {
      setError(err?.message || 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  if (created) {
    return (
      <div className="lg-page">
        <style>{css}</style>
        <section className="lg-card" aria-labelledby="su-done-title">
          <h1 id="su-done-title" className="lg-title">Welcome, {created.name}!</h1>
          <p className="lg-note">
            Your account is created — you are <strong>customer #{created.id}</strong>.
            {created.id === 1 && ' That makes you the very first registered customer. 🎉'}
          </p>
          <button className="lg-btn" onClick={() => onSignUp(created)}>
            Start Shopping
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="lg-page">
      <style>{css}</style>
      <section className="lg-card" aria-labelledby="su-title">
        <h1 id="su-title" className="lg-title">Create Account</h1>

        <label htmlFor="su-name" className="lg-sr">
          Name
        </label>
        <input
          id="su-name"
          ref={nameRef}
          className="lg-input"
          type="text"
          autoComplete="name"
          placeholder="Full Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError();
          }}
          onKeyDown={onKeyDown}
          aria-invalid={!!error}
        />

        <label htmlFor="su-email" className="lg-sr">
          Email
        </label>
        <input
          id="su-email"
          className="lg-input"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError();
          }}
          onKeyDown={onKeyDown}
          aria-invalid={!!error}
        />

        <label htmlFor="su-pw" className="lg-sr">
          Password
        </label>
        <input
          id="su-pw"
          className="lg-input"
          type="password"
          autoComplete="new-password"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError();
          }}
          onKeyDown={onKeyDown}
          aria-invalid={!!error}
          aria-describedby={error ? 'su-error' : 'su-hint'}
        />
        <p id="su-hint" className="lg-hint">
          At least 8 characters.
        </p>

        {error && (
          <p id="su-error" className="lg-error" role="alert">
            {error}
          </p>
        )}

        <button className="lg-btn" onClick={handleSubmit} disabled={submitting || loading}>
          {submitting || loading ? 'Creating account...' : 'Create Account'}
        </button>

        <button className="lg-link lg-link--first" onClick={onLogIn}>
          Log In
        </button>
        <button className="lg-link" onClick={onBack}>
          Back
        </button>
      </section>
    </div>
  );
}

// Same auth-card styles as LoginPage (each page in this app embeds its
// own styles), plus the hint/success-note lines this form adds.
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
.lg-hint { margin: -8px 0 10px; text-align: left; font-size: .8rem; color: #8a8a8a; }
.lg-note { margin: 0 0 22px; font-size: 1.05rem; line-height: 1.5; color: #e6e6e6; }
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
