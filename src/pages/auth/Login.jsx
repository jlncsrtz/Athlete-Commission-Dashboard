import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Mail, RefreshCw } from 'lucide-react';
import { requestPasswordReset, signIn, signUp } from '../../api';
import BrandMark from '../../components/common/BrandMark';
import Field from '../../components/common/Field';
import FormAlertModal from '../../components/common/FormAlertModal';
import Notice from '../../components/common/Notice';
import PasswordChecklist from '../../components/common/PasswordChecklist';
import { passwordErrors, validateEmail } from '../../utils/validation';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [formErrors, setFormErrors] = useState([]);

  function showErrors(errors) {
    setFormErrors((Array.isArray(errors) ? errors : [errors]).filter(Boolean));
  }

  async function submit(event) {
    event.preventDefault();
    setFormErrors([]);
    setMessage('');

    const emailError = validateEmail(email);
    const errors = emailError ? [emailError] : [];

    if (!mode || mode === 'login') {
      if (!password) errors.push('Password is required.');
    }

    if (mode === 'signup') {
      errors.push(...passwordErrors(password, email));
      if (password !== confirmPassword) errors.push('Passwords do not match. Please re-enter your confirmation password.');
    }

    if (errors.length) {
      showErrors(errors);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else if (mode === 'signup') {
        const data = await signUp(email.trim(), password);
        if (!data.session) {
          setMessage('Account created. Check your email to confirm your account, then sign in.');
        } else {
          setMessage('Account created.');
        }
      } else {
        await requestPasswordReset(email.trim());
        setMessage('Password reset link sent. Check your email and open the link to create a new password.');
      }
    } catch (err) {
      showErrors(err?.message || 'Unable to continue. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormErrors([]);
    setMessage('');
  }

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  return (
    <div className="auth-shell login-shell">
      <div className="login-left">
        <div className="auth-brand large">
          <BrandMark />
          <div>
            <strong>PEAKATHLETE</strong>
            <span>Athlete's Commission Portal</span>
          </div>
        </div>

        <div className="login-message">
          <span className="eyebrow">ATHLETE'S PAYOUT SYSTEM</span>
          <h1>
            YOUR INFLUENCE
            <br />
            <em>YOUR EARNINGS</em>
          </h1>
          <p>A dedicated commission dashboard for PEAKATHLETE Athletes.</p>
        </div>
      </div>

      <div className="login-right">
        <form className="auth-card login-card" onSubmit={submit} noValidate>
          <span className="eyebrow">
            {isLogin ? 'WELCOME BACK' : isSignup ? 'NEW ATHLETE' : 'ACCOUNT RECOVERY'}
          </span>
          <h2>
            {isLogin ? 'Sign in to continue' : isSignup ? 'Create athlete account' : 'Forgot your password?'}
          </h2>
          <p>
            {isLogin
              ? 'Use the email and password for your account.'
              : isSignup
                ? 'Create a secure account first. After signup, complete your athlete application for admin approval.'
                : 'Enter your account email and we will send you a password reset link.'}
          </p>

          {message && <Notice type="success">{message}</Notice>}

          <Field label="Email">
            <div className={isForgot ? 'email-icon-wrap' : ''}>
              {isForgot && <Mail size={17} />}
              <input
                type="email"
                required
                maxLength="254"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
              />
            </div>
          </Field>

          {!isForgot && (
            <Field label="Password">
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  minLength={isSignup ? 8 : 1}
                  maxLength="128"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="password-eye"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
          )}

          {isSignup && <PasswordChecklist password={password} />}

          {isLogin && (
            <button type="button" className="forgot-password-btn" onClick={() => changeMode('forgot')}>
              Forgot password?
            </button>
          )}

          {isSignup && (
            <Field label="Confirm password">
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
                <button
                  type="button"
                  className="password-eye"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
          )}

          <button className="primary-btn full" disabled={busy}>
            {busy ? <RefreshCw className="spin" size={17} /> : isForgot ? <Mail size={17} /> : <ChevronRight size={18} />}
            {isLogin ? 'Sign in' : isSignup ? 'Create account' : 'Send reset link'}
          </button>

          {isForgot ? (
            <button type="button" className="text-btn auth-toggle" onClick={() => changeMode('login')}>
              <ChevronLeft size={15} /> Back to sign in
            </button>
          ) : (
            <button type="button" className="text-btn auth-toggle" onClick={() => changeMode(isLogin ? 'signup' : 'login')}>
              {isLogin ? 'New athlete? Create an account' : 'Already have an account? Sign in'}
            </button>
          )}

          <small className="demo-note">
            Admin accounts sign in here too. Role access is decided securely by the database.
          </small>
        </form>
      </div>

      <FormAlertModal
        open={formErrors.length > 0}
        errors={formErrors}
        onClose={() => setFormErrors([])}
      />
    </div>
  );
}
