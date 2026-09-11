import React, { useEffect, useState } from 'react';
import { Check, CreditCard, Eye, EyeOff, ImagePlus, KeyRound, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { signedImage, updateMyPassword, updateMyPayoutProfile, uploadMyQr } from '../../api';
import Field from '../../components/common/Field';
import FormAlertModal from '../../components/common/FormAlertModal';
import Notice from '../../components/common/Notice';
import PageHeader from '../../components/common/PageHeader';
import PasswordChecklist from '../../components/common/PasswordChecklist';
import {
  cleanNameInput,
  digitsOnly,
  isEwallet,
  passwordErrors,
  validateImageFile,
  validateProfileForm,
} from '../../utils/validation';

export default function PayoutProfile({ account, onSaved }) {
  const payoutAccount = account.payoutAccount;
  const [form, setForm] = useState({
    firstName: account.profile.first_name || '',
    middleName: account.profile.middle_name || '',
    lastName: account.profile.last_name || '',
    address: account.profile.address || '',
    mobile: digitsOnly(account.profile.mobile_number || '', 11),
    payoutMethod: payoutAccount?.payout_method || 'GCash',
    accountName: payoutAccount?.account_name || '',
    accountNumber: digitsOnly(payoutAccount?.account_number || '', 20),
    bankName: payoutAccount?.bank_name || '',
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [existing, setExisting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  const [popup, setPopup] = useState({ title: '', errors: [] });

  function showErrors(errors, title = 'Please check your information') {
    setPopup({ title, errors: (Array.isArray(errors) ? errors : [errors]).filter(Boolean) });
  }

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

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function chooseImage(selected, input) {
    if (!selected) return;
    const imageError = await validateImageFile(selected, { required: true });
    if (imageError) {
      if (input) input.value = '';
      setFile(null);
      setPreview(null);
      showErrors(imageError, 'QR image needs attention');
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function save(event) {
    event.preventDefault();
    setMessage('');

    const errors = validateProfileForm(form);
    if (file) {
      const imageError = await validateImageFile(file, { required: true });
      if (imageError) errors.push(imageError);
    } else if (!payoutAccount?.qr_code_path) {
      errors.push('Please upload your GCash / bank QR image.');
    }

    if (errors.length) {
      showErrors(errors);
      return;
    }

    setBusy(true);
    try {
      const path = file ? await uploadMyQr(account.user.id, file) : null;
      await updateMyPayoutProfile(form, path);
      setMessage('Profile saved and sent for admin review.');
      await onSaved();
    } catch (err) {
      showErrors(err?.message || 'Unable to save your profile. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordMessage('');

    const errors = passwordErrors(newPassword, account.profile.email || account.user.email || '');
    if (newPassword !== confirmPassword) errors.push('Passwords do not match.');
    if (errors.length) {
      showErrors(errors, 'Password needs attention');
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
      showErrors(err?.message || 'Unable to change password.', 'Password could not be changed');
    } finally {
      setPasswordBusy(false);
    }
  }

  const ewallet = isEwallet(form.payoutMethod);

  return (
    <>
      <PageHeader
        eyebrow="ATHLETE PROFILE"
        title="Manage your account."
        subtitle="Update your real personal details, direct-payment account, QR image, and password. Profile changes are reviewed by admin."
      />
      {message && <Notice type="success">{message}</Notice>}

      <form className="profile-grid" onSubmit={save} noValidate>
        <div className="panel form-panel">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">PERSONAL INFORMATION</span>
              <h3>Athlete's details</h3>
            </div>
            <UserRound size={20} />
          </div>
          <div className="field-grid two">
            <Field label="First name">
              <input
                required
                maxLength="60"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: cleanNameInput(e.target.value) })}
              />
            </Field>
            <Field label="Middle name">
              <input
                maxLength="60"
                autoComplete="additional-name"
                value={form.middleName}
                onChange={(e) => setForm({ ...form, middleName: cleanNameInput(e.target.value) })}
                placeholder="Optional"
              />
            </Field>
            <Field label="Surname">
              <input
                required
                maxLength="60"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: cleanNameInput(e.target.value) })}
              />
            </Field>
            <Field label="Email"><input disabled value={account.profile.email || account.user.email || ''} /></Field>
            <Field label="Mobile number">
              <input
                required
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="11"
                autoComplete="tel"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: digitsOnly(e.target.value, 11) })}
                placeholder="09171234567"
              />
            </Field>
            <Field label="Athlete's code"><input disabled value={account.affiliate.affiliate_code} /></Field>
            <div className="field-span-two">
              <Field label="Complete address">
                <textarea
                  required
                  rows="3"
                  maxLength="220"
                  autoComplete="street-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value.slice(0, 220) })}
                  placeholder="House / street, barangay, city / municipality, province"
                />
              </Field>
            </div>
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
              <select
                value={form.payoutMethod}
                onChange={(e) => {
                  const payoutMethod = e.target.value;
                  setForm({ ...form, payoutMethod, bankName: isEwallet(payoutMethod) ? '' : form.bankName });
                }}
              >
                <option>GCash</option><option>Maya</option><option>BDO</option><option>BPI</option><option>UnionBank</option><option>Metrobank</option><option>Other Bank</option>
              </select>
            </Field>
            <Field label="Account name">
              <input
                required
                maxLength="60"
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: cleanNameInput(e.target.value) })}
                placeholder="Name registered on the account"
              />
            </Field>
            <Field label={ewallet ? `${form.payoutMethod} mobile number` : 'Bank account number'}>
              <input
                required
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={ewallet ? 11 : 20}
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: digitsOnly(e.target.value, ewallet ? 11 : 20) })}
                placeholder={ewallet ? '09171234567' : 'Numbers only'}
              />
            </Field>
            <Field label={ewallet ? 'Bank name (not needed)' : 'Bank name'}>
              <input
                disabled={ewallet}
                required={!ewallet}
                maxLength="80"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value.slice(0, 80) })}
                placeholder={ewallet ? 'Not required for e-wallets' : 'Enter bank name'}
              />
            </Field>
          </div>
          <label className="upload-box clickable">
            {preview || existing
              ? <><img src={preview || existing} alt="Payment QR" /><span className="upload-success-label">QR image ready — click to replace</span></>
              : <><ImagePlus size={28} /><strong>Upload GCash / bank QR image</strong><span>Required • real PNG, JPG/JPEG or WEBP • max 5 MB</span></>}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => chooseImage(e.target.files?.[0], e.target)}
            />
          </label>
          <button className="primary-btn" disabled={busy}>
            {busy ? <RefreshCw className="spin" size={17} /> : <Check size={17} />} Save profile
          </button>
        </div>
      </form>

      <form className="panel password-profile-panel" onSubmit={changePassword} noValidate>
        <div className="section-title-row">
          <div>
            <span className="eyebrow">ACCOUNT SECURITY</span>
            <h3>Change password</h3>
          </div>
          <KeyRound size={20} />
        </div>

        {passwordMessage && <Notice type="success">{passwordMessage}</Notice>}

        <div className="security-note password-security-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Keep your account secure</strong>
            <span>Use a unique password that meets every requirement below. Do not reuse your email password.</span>
          </div>
        </div>

        <div className="field-grid two password-fields-grid">
          <Field label="New password">
            <div className="password-wrap">
              <input
                type={showNewPassword ? 'text' : 'password'}
                minLength="8"
                maxLength="128"
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
        </div>

        <PasswordChecklist password={newPassword} />

        <button className="secondary-btn change-password-submit" disabled={passwordBusy}>
          {passwordBusy ? <RefreshCw className="spin" size={17} /> : <KeyRound size={17} />} Change password
        </button>
      </form>

      <FormAlertModal
        open={popup.errors.length > 0}
        title={popup.title}
        errors={popup.errors}
        onClose={() => setPopup({ title: '', errors: [] })}
      />
    </>
  );
}
