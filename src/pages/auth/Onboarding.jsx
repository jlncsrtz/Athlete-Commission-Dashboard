import React, { useEffect, useState } from 'react';
import { Check, ImagePlus, RefreshCw, ShieldCheck } from 'lucide-react';
import { completeOnboarding, uploadMyQr } from '../../api';
import BrandMark from '../../components/common/BrandMark';
import Field from '../../components/common/Field';
import FormAlertModal from '../../components/common/FormAlertModal';
import {
  cleanNameInput,
  digitsOnly,
  isEwallet,
  validateImageFile,
  validateProfileForm,
} from '../../utils/validation';

export default function Onboarding({ account, onComplete }) {
  const [form, setForm] = useState({
    firstName: account.profile.first_name || '',
    middleName: account.profile.middle_name || '',
    lastName: account.profile.last_name || '',
    address: account.profile.address || '',
    mobile: digitsOnly(account.profile.mobile_number || '', 11),
    affiliateCode: '',
    payoutMethod: 'GCash',
    accountName: '',
    accountNumber: '',
    bankName: '',
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formErrors, setFormErrors] = useState([]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function showErrors(errors) {
    setFormErrors((Array.isArray(errors) ? errors : [errors]).filter(Boolean));
  }

  async function choose(selectedFile, input) {
    if (!selectedFile) return;
    const imageError = await validateImageFile(selectedFile, { required: true });
    if (imageError) {
      if (input) input.value = '';
      setFile(null);
      setPreview(null);
      showErrors(imageError);
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  }

  async function submit(event) {
    event.preventDefault();
    setFormErrors([]);

    const errors = validateProfileForm(form, { includeAffiliateCode: true });
    const imageError = await validateImageFile(file, { required: true });
    if (imageError) errors.push(imageError);

    if (errors.length) {
      showErrors(errors);
      return;
    }

    setBusy(true);
    try {
      const path = await uploadMyQr(account.user.id, file);
      await completeOnboarding(form, path);
      await onComplete();
    } catch (err) {
      showErrors(err?.message || 'Unable to submit your athlete application. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const ewallet = isEwallet(form.payoutMethod);

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <BrandMark />
        <div>
          <strong>PEAKATHLETE</strong>
          <span>Athlete's Commission Portal</span>
        </div>
      </div>

      <div className="auth-card onboarding-card">
        <div className="auth-copy">
          <span className="eyebrow">FIRST-TIME SETUP</span>
          <h1>Complete your athlete profile.</h1>
          <p>Use your real personal and payout information. Your account will be activated only after admin review.</p>
        </div>

        <form onSubmit={submit} className="onboarding-form" noValidate>
          <div className="form-section-caption">
            <strong>Personal information</strong>
            <span>Enter the same name and contact details you normally use for official transactions.</span>
          </div>

          <div className="field-grid two">
            <Field label="First name">
              <input
                required
                maxLength="60"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: cleanNameInput(event.target.value) })}
                placeholder="Juan"
              />
            </Field>
            <Field label="Middle name">
              <input
                maxLength="60"
                autoComplete="additional-name"
                value={form.middleName}
                onChange={(event) => setForm({ ...form, middleName: cleanNameInput(event.target.value) })}
                placeholder="Optional"
              />
            </Field>
            <Field label="Surname">
              <input
                required
                maxLength="60"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: cleanNameInput(event.target.value) })}
                placeholder="Dela Cruz"
              />
            </Field>
            <Field label="Email">
              <input disabled value={account.profile.email || account.user.email || ''} />
            </Field>
            <Field label="Mobile number">
              <input
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                pattern="[0-9]*"
                maxLength="11"
                value={form.mobile}
                onChange={(event) => setForm({ ...form, mobile: digitsOnly(event.target.value, 11) })}
                placeholder="09171234567"
              />
            </Field>
            <Field label="Preferred athlete code">
              <input
                required
                minLength="3"
                maxLength="20"
                value={form.affiliateCode}
                onChange={(event) =>
                  setForm({
                    ...form,
                    affiliateCode: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20),
                  })
                }
                placeholder="e.g. JUAN10"
              />
            </Field>
            <div className="field-span-two">
              <Field label="Complete address">
                <textarea
                  required
                  rows="3"
                  maxLength="220"
                  autoComplete="street-address"
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value.slice(0, 220) })}
                  placeholder="House / street, barangay, city / municipality, province"
                />
              </Field>
            </div>
          </div>

          <div className="form-section-caption payout-section-caption">
            <strong>Direct payment details</strong>
            <span>Use an account that belongs to you so payout verification is easier.</span>
          </div>

          <div className="field-grid two">
            <Field label="Payment method">
              <select
                value={form.payoutMethod}
                onChange={(event) => {
                  const payoutMethod = event.target.value;
                  setForm({ ...form, payoutMethod, bankName: isEwallet(payoutMethod) ? '' : form.bankName });
                }}
              >
                <option>GCash</option>
                <option>Maya</option>
                <option>MariBank</option>
                <option>GoTyme Bank</option>
                <option>BDO</option>
                <option>BPI</option>
                <option>UnionBank</option>
                <option>Metrobank</option>
                <option>Other Bank</option>
              </select>
            </Field>
            <Field label="Account name">
              <input
                required
                maxLength="60"
                autoComplete="name"
                value={form.accountName}
                onChange={(event) => setForm({ ...form, accountName: cleanNameInput(event.target.value) })}
                placeholder="Name registered on the account"
              />
            </Field>
            <Field label={ewallet ? `${form.payoutMethod} mobile number` : 'Bank account number'}>
              <input
                required
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={ewallet ? 11 : 20}
                value={form.accountNumber}
                onChange={(event) => setForm({ ...form, accountNumber: digitsOnly(event.target.value, ewallet ? 11 : 20) })}
                placeholder={ewallet ? '09171234567' : 'Numbers only'}
              />
            </Field>
            <Field label={ewallet ? 'Bank name (not needed)' : 'Bank name'}>
              <input
                disabled={ewallet}
                required={!ewallet}
                maxLength="80"
                value={form.bankName}
                onChange={(event) => setForm({ ...form, bankName: event.target.value.slice(0, 80) })}
                placeholder={ewallet ? 'Not required for e-wallets' : 'Enter bank name'}
              />
            </Field>
          </div>

          <label className="upload-box clickable">
            {preview ? (
              <>
                <img src={preview} alt="Uploaded payment QR preview" />
                <span className="upload-success-label">Image selected — click to replace</span>
              </>
            ) : (
              <>
                <ImagePlus size={28} />
                <strong>Add GCash / bank QR image</strong>
                <span>Required • real PNG, JPG/JPEG or WEBP • max 5 MB</span>
              </>
            )}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => choose(event.target.files?.[0], event.target)}
            />
          </label>

          <div className="security-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Admin review required</strong>
              <span>Your identity, payout account, and QR image will be reviewed before your athlete dashboard is activated.</span>
            </div>
          </div>

          <button className="primary-btn full" disabled={busy}>
            {busy ? <RefreshCw className="spin" size={17} /> : <Check size={17} />}
            Submit for admin approval
          </button>
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
