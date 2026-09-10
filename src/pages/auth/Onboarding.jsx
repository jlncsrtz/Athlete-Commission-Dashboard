import React, { useState } from 'react';
import { Check, ImagePlus, RefreshCw, ShieldCheck } from 'lucide-react';
import { completeOnboarding, uploadMyQr } from '../../api';
import BrandMark from '../../components/common/BrandMark';
import Field from '../../components/common/Field';
import Notice from '../../components/common/Notice';

export default function Onboarding({ account, onComplete }) {
  const [form, setForm] = useState({
    fullName: account.profile.full_name || '',
    mobile: account.profile.mobile_number || '',
    affiliateCode: '',
    payoutMethod: 'GCash',
    accountName: '',
    accountNumber: '',
    bankName: '',
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function choose(selectedFile) {
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const path = await uploadMyQr(account.user.id, file);
      await completeOnboarding(form, path);
      await onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

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
          <h1>Complete your payout profile.</h1>
          <p>Add your payment details so the admin can pay your commissions directly.</p>
        </div>

        {error && <Notice type="error">{error}</Notice>}

        <form onSubmit={submit} className="onboarding-form">
          <div className="field-grid two">
            <Field label="Full name">
              <input
                required
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              />
            </Field>
            <Field label="Email">
              <input disabled value={account.profile.email || account.user.email || ''} />
            </Field>
            <Field label="Mobile number">
              <input
                required
                value={form.mobile}
                onChange={(event) => setForm({ ...form, mobile: event.target.value })}
              />
            </Field>
            <Field label="Preferred athlete code">
              <input
                required
                minLength="3"
                value={form.affiliateCode}
                onChange={(event) =>
                  setForm({
                    ...form,
                    affiliateCode: event.target.value.toUpperCase().replace(/\s/g, ''),
                  })
                }
                placeholder="e.g. JUAN10"
              />
            </Field>
            <Field label="Payment method">
              <select
                value={form.payoutMethod}
                onChange={(event) => setForm({ ...form, payoutMethod: event.target.value })}
              >
                <option>GCash</option>
                <option>Maya</option>
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
                value={form.accountName}
                onChange={(event) => setForm({ ...form, accountName: event.target.value })}
              />
            </Field>
            <Field label="GCash / bank account number">
              <input
                required
                value={form.accountNumber}
                onChange={(event) => setForm({ ...form, accountNumber: event.target.value })}
              />
            </Field>
            <Field label="Bank name (if applicable)">
              <input
                value={form.bankName}
                onChange={(event) => setForm({ ...form, bankName: event.target.value })}
                placeholder="Optional for GCash"
              />
            </Field>
          </div>

          <label className="upload-box clickable">
            {preview ? (
              <img src={preview} alt="QR preview" />
            ) : (
              <>
                <ImagePlus size={28} />
                <strong>Add GCash / bank QR code</strong>
                <span>PNG, JPG or WEBP • max 5 MB</span>
              </>
            )}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
              onChange={(event) => choose(event.target.files?.[0])}
            />
          </label>

          <div className="security-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Security reminder</strong>
              <span>Never upload OTPs, PINs, passwords, CVVs, or card security details.</span>
            </div>
          </div>

          <button className="primary-btn full" disabled={busy}>
            {busy ? <RefreshCw className="spin" size={17} /> : <Check size={17} />}
            Save payment profile
          </button>
        </form>
      </div>
    </div>
  );
}
