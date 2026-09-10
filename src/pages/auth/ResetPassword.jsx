import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react';
import { updateMyPassword } from '../../api';
import BrandMark from '../../components/common/BrandMark';
import Field from '../../components/common/Field';
import Notice from '../../components/common/Notice';

export default function ResetPassword({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await updateMyPassword(password);
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Unable to update password.');
    } finally {
      setBusy(false);
    }
  }

  function continueToPortal() {
    window.history.replaceState({}, document.title, window.location.pathname);
    onComplete();
  }

  return (
    <div className="auth-shell reset-password-shell">
      <div className="auth-card reset-password-card">
        <div className="auth-brand reset-brand">
          <BrandMark />
          <div>
            <strong>PEAKATHLETE</strong>
            <span>Athlete's Commission Portal</span>
          </div>
        </div>

        {success ? (
          <div className="reset-success">
            <CheckCircle2 size={42} />
            <span className="eyebrow">PASSWORD UPDATED</span>
            <h1>Your password has been changed.</h1>
            <p>You can continue to your Peakathlete account using your new password.</p>
            <button className="primary-btn full" onClick={continueToPortal}>Continue to portal</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="reset-icon"><KeyRound size={24} /></div>
            <span className="eyebrow">ACCOUNT RECOVERY</span>
            <h1>Create a new password.</h1>
            <p className="reset-copy">Use at least 8 characters and make sure both password fields match.</p>

            {error && <Notice type="error">{error}</Notice>}

            <Field label="New password">
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  minLength="8"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" className="password-eye" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            <Field label="Confirm new password">
              <div className="password-wrap">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  minLength="8"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" className="password-eye" onClick={() => setShowConfirmPassword((value) => !value)}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            <button className="primary-btn full" disabled={busy}>
              {busy ? <RefreshCw className="spin" size={17} /> : <KeyRound size={17} />}
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
