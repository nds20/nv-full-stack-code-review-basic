import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function AgeGate({ onVerify = (zip) => console.log('verified', zip), onLogIn = () => console.log('log in'), isAllowedZip }) {
  const { verifyAge, loading, error: authError } = useAuth();
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => inputRef.current?.focus(), []);

  const handleChange = (e) => {
    setZip(e.target.value.replace(/\D/g, '').slice(0, 5));
    if (error) setError('');
  };

  const handleSubmit = async () => {
    if (!/^\d{5}$/.test(zip)) {
      setError('Enter a 5-digit ZIP code.');
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      if (isAllowedZip && !(await isAllowedZip(zip))) {
        setError("We can't serve this ZIP code yet. Check local availability.");
        return;
      }
      await verifyAge(zip);
      onVerify(zip);
    } catch {
      setError("Couldn't verify your location. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="ag-page">
      <style>{css}</style>
      <section className="ag-card" role="dialog" aria-labelledby="ag-title" aria-describedby="ag-desc">
        <h1 id="ag-title" className="ag-title">Verify Your Age & Location</h1>
        <p id="ag-desc" className="ag-desc">
          You must be 21 or older to enter. Please confirm your municipality to ensure compliance with local regulations.
        </p>

        <label htmlFor="ag-zip" className="ag-sr">ZIP code</label>
        <input
          id="ag-zip"
          ref={inputRef}
          className={`ag-input${error ? ' ag-input--error' : ''}`}
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Enter your ZIP code"
          value={zip}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          aria-invalid={!!error}
          aria-describedby={error ? 'ag-error' : undefined}
        />
        {error && (
          <p id="ag-error" className="ag-error" role="alert">
            {error}
          </p>
        )}

        <button className="ag-btn" onClick={handleSubmit} disabled={submitting || loading}>
          {submitting || loading ? 'Verifying...' : 'Verify & Continue'}
        </button>

        <button className="ag-link" onClick={onLogIn}>
          Log In
        </button>
      </section>
    </div>
  );
}

const css = `
.ag-page {
  min-height: 100vh; display: grid; place-items: center; padding: 24px;
  background: #000; color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
}
.ag-card {
  width: 100%; max-width: 405px; box-sizing: border-box;
  padding: 44px 28px 32px; text-align: center;
  background: #0d0d0d; border: 1px solid #2e2e2e; border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0,0,0,.6);
}
.ag-title { margin: 0 0 18px; font-size: 1.6rem; font-weight: 700; letter-spacing: -0.01em; }
.ag-desc { margin: 0 auto 32px; max-width: 30ch; font-size: 1rem; line-height: 1.5; color: #b3b3b3; }
.ag-input {
  width: 100%; box-sizing: border-box; height: 58px; padding: 0 16px;
  font: inherit; font-size: 1.05rem; color: #fff;
  background: #0d0d0d; border: 1px solid #4a4a4a; border-radius: 6px; outline: none;
  transition: border-color .15s;
}
.ag-input::placeholder { color: #8a8a8a; }
.ag-input:focus { border-color: #2f7a35; box-shadow: 0 0 0 3px rgba(47,122,53,.35); }
.ag-input--error { border-color: #d9534f; }
.ag-error { margin: 8px 0 0; text-align: left; font-size: .875rem; color: #ff7b75; }
.ag-btn {
  width: 100%; height: 60px; margin-top: 28px;
  font: inherit; font-size: 1.2rem; font-weight: 600; color: #fff;
  background: #2b622f; border: 0; border-radius: 6px; cursor: pointer;
  transition: background .15s;
}
.ag-btn:hover:not(:disabled) { background: #33733a; }
.ag-btn:disabled { opacity: .7; cursor: default; }
.ag-btn:focus-visible, .ag-link:focus-visible { outline: 2px solid #6fbf73; outline-offset: 3px; }
.ag-link {
  margin-top: 28px; padding: 6px 12px; background: none; border: 0; cursor: pointer;
  font: inherit; font-size: 1.05rem; color: #bdbdbd; border-radius: 4px;
}
.ag-link:hover { color: #fff; }
.ag-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
`;
