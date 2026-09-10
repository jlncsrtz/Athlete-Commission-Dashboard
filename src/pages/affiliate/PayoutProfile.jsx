import React, { useEffect, useState } from 'react';
import { Check, CreditCard, Eye, EyeOff, ImagePlus, KeyRound, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { signedImage, updateMyPassword, updateMyPayoutProfile, uploadMyQr } from '../../api';
import Field from '../../components/common/Field';
import Notice from '../../components/common/Notice';
import PageHeader from '../../components/common/PageHeader';

export default function PayoutProfile({ account, onSaved }) {
  const payoutAccount = account.payoutAccount;
  const [form, setForm] = useState({
    fullName: account.profile.full_name || '',
    mobile: account.profile.mobile_number || '',
    payoutMethod: payoutAccount?.payout_method || 'GCash',
    accountName: payoutAccount?.account_name || '',
    accountNumber: payoutAccount?.account_number || '',
    bankName: payoutAccount?.bank_name || '',
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [existing, setExisting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (payoutAccount?.qr_code_path) {
        const url = await signedImage('affiliate-qr', payoutAccount.qr_code_path);
        if (alive) setExisting(url);
      }
    })();
    return () => { alive = false; };
  }, [payoutAccount?.qr_code_path]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');

    try {
      const path = file ? await uploadMyQr(account.user.id, file) : null;
      await updateMyPayoutProfile(form, path);
      setMessage('Profile and payment details saved.');
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordBusy(true);
    try {
      await updateMyPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordMessage('Password changed successfully. Use your new password the next time you sign in.');
    } catch (err) {
      setPasswordError(err.message || 'Unable to change password.');
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="ATHLETE PROFILE"
        title="Manage your account."
        subtitle="Update your personal details, direct-payment account, QR code, and password."
      />
      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}

      <form className="profile-grid" onSubmit={save}>
        <div className="panel form-panel">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">PERSONAL INFORMATION</span>
              <h3>Athlete's details</h3>
            </div>
            <UserRound size={20} />
          </div>
          <div className="field-grid two">
            <Field label="Full name">
              <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Email"><input disabled value={account.profile.email || account.user.email || ''} /></Field>
            <Field label="Mobile number">
              <input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </Field>
            <Field label="Athlete's code"><input disabled value={account.affiliate.affiliate_code} /></Field>
          </div>
        </div>

        <div className="panel form-panel">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">DIRECT PAYMENT DETAILS</span>
              <h3>Payment account</h3>
            </div>
            <CreditCard size={20} />
          </div>
          <div className="field-grid two">
            <Field label="Payment method">
              <select value={form.payoutMethod} onChange={(e) => setForm({ ...form, payoutMethod: e.target.value })}>
                <option>GCash</option><option>Maya</option><option>BDO</option><option>BPI</option><option>UnionBank</option><option>Metrobank</option><option>Other Bank</option>
              </select>
            </Field>
            <Field label="Account name"><input required value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} /></Field>
            <Field label="GCash / account number"><input required value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></Field>
            <Field label="Bank name"><input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></Field>
          </div>
          <label className="upload-box clickable">
            {preview || existing
              ? <img src={preview || existing} alt="Payment QR" />
              : <><ImagePlus size={28} /><strong>Upload GCash / bank QR code</strong><span>PNG, JPG or WEBP • max 5 MB</span></>}
            <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const selected = e.target.files?.[0]; if (selected) { setFile(selected); setPreview(URL.createObjectURL(selected)); } }} />
          </label>
          <button className="primary-btn" disabled={busy}>
            {busy ? <RefreshCw className="spin" size={17} /> : <Check size={17} />} Save profile
          </button>
        </div>
      </form>

      <form className="panel password-profile-panel" onSubmit={changePassword}>
        <div className="section-title-row">
          <div>
            <span className="eyebrow">ACCOUNT SECURITY</span>
            <h3>Change password</h3>
          </div>
          <KeyRound size={20} />
        </div>

        {passwordError && <Notice type="error">{passwordError}</Notice>}
        {passwordMessage && <Notice type="success">{passwordMessage}</Notice>}

        <div className="security-note password-security-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Keep your account secure</strong>
            <span>Use at least 8 characters and avoid reusing a password from another account.</span>
          </div>
        </div>

        <div className="field-grid two password-fields-grid">
          <Field label="New password">
            <div className="password-wrap">
              <input
                type={showNewPassword ? 'text' : 'password'}
                minLength="8"
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
              <button type="button" className="password-eye" onClick={() => setShowNewPassword((value) => !value)}>
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
        </div>

        <button className="secondary-btn change-password-submit" disabled={passwordBusy}>
          {passwordBusy ? <RefreshCw className="spin" size={17} /> : <KeyRound size={17} />} Change password
        </button>
      </form>
    </>
  );
}
