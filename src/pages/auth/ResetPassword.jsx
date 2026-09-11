import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react';
import { updateMyPassword } from '../../api';
import BrandMark from '../../components/common/BrandMark';
import Field from '../../components/common/Field';
import FormAlertModal from '../../components/common/FormAlertModal';
import PasswordChecklist from '../../components/common/PasswordChecklist';
import { passwordErrors } from '../../utils/validation';

export default function ResetPassword({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState([]);

  async function submit(event) {
    event.preventDefault();
    setFormErrors([]);

    const errors = passwordErrors(password);
    if (password !== confirmPassword) errors.push('Passwords do not match.');
    if (errors.length) {
      setFormErrors(errors);
      return;
    }

    setBusy(true);
    try {
      await updateMyPassword(password);
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setFormErrors([err?.message || 'Unable to update password.']);
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
          <form onSubmit={submit} noValidate>
            <div className="reset-icon"><KeyRound size={24} /></div>
            <span className="eyebrow">ACCOUNT RECOVERY</span>
            <h1>Create a new password.</h1>
            <p className="reset-copy">Use a strong password that meets every security requirement below.</p>

            <Field label="New password">
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  minLength="8"
                  maxLength="128"
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

            <PasswordChecklist password={password} />

            <Field label="Confirm new password">
              <div className="password-wrap">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  minLength="8"
                  maxLength="128"
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

      <FormAlertModal
        open={formErrors.length > 0}
        title="Password needs attention"
        errors={formErrors}
        onClose={() => setFormErrors([])}
      />
    </div>
  );
}
