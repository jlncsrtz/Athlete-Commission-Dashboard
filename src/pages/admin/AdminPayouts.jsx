import React, { useState } from 'react';
import { CheckCircle2, Eye, RefreshCw, Upload, Wallet, X } from 'lucide-react';
import { adminMarkPayoutPaid, signedImage, uploadPayoutReceipt } from '../../api';
import Field from '../../components/common/Field';
import Modal from '../../components/common/Modal';
import Notice from '../../components/common/Notice';
import PageHeader from '../../components/common/PageHeader';
import StatusPill from '../../components/common/StatusPill';
import { affiliateProfile, dateLabel, payoutAccount, peso } from '../../utils/helpers';

export default function AdminPayouts({ data, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [payment, setPayment] = useState({ method: 'GCash', ref: '', note: '', file: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedAffiliate = selected
    ? data.affiliates.find((affiliate) => affiliate.id === selected.affiliate_id)
    : null;
  const selectedPayoutAccount = selectedAffiliate ? payoutAccount(selectedAffiliate) : null;

  async function process(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!selectedAffiliate) throw new Error('Athlete account not found.');
      const path = await uploadPayoutReceipt(
        selectedAffiliate.user_id,
        selected.id,
        payment.file,
      );
      await adminMarkPayoutPaid(selected.id, payment, path);
      setSelected(null);
      setPayment({ method: 'GCash', ref: '', note: '', file: null });
      await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function viewReceipt(payout) {
    const url = await signedImage('payout-receipts', payout.receipt_path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function viewSelectedQr() {
    if (!selectedPayoutAccount?.qr_code_path) return;
    const url = await signedImage('affiliate-qr', selectedPayoutAccount.qr_code_path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <PageHeader
        eyebrow="PAYOUTS"
        title="Payout ledger"
        subtitle="Ready, paid, and historical athlete commission batches."
      />
      {error && <Notice type="error">{error}</Notice>}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Athlete</th><th>Period</th><th>Sales</th><th>Commission</th><th>Status</th><th>Reference</th><th>Action</th></tr>
            </thead>
            <tbody>
              {data.payouts.map((payout) => {
                const affiliate = data.affiliates.find((item) => item.id === payout.affiliate_id);
                return (
                  <tr key={payout.id}>
                    <td>{affiliateProfile(affiliate || {}).full_name}</td>
                    <td>{dateLabel(payout.period_start)} – {dateLabel(payout.period_end)}</td>
                    <td>{peso(payout.qualified_sales)}</td>
                    <td className="strong-cell">{peso(payout.commission_amount)}</td>
                    <td><StatusPill status={payout.status} /></td>
                    <td className="mono">{payout.reference_number || '—'}</td>
                    <td>
                      {payout.status === 'ready' ? (
                        <button
                          className="primary-btn tiny"
                          onClick={() => {
                            setSelected(payout);
                            setPayment({
                              method: payoutAccount(affiliate || {})?.payout_method || 'GCash',
                              ref: '',
                              note: '',
                              file: null,
                            });
                          }}
                        >
                          <Wallet size={15} /> Pay
                        </button>
                      ) : payout.receipt_path ? (
                        <button className="text-btn" onClick={() => viewReceipt(payout)}>
                          <Eye size={15} /> Receipt
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data.payouts.length && <div className="empty">No payout batches yet.</div>}
        </div>
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <form onSubmit={process} className="modal-form">
            <div className="modal-head">
              <div>
                <span className="eyebrow">PROCESS PAYOUT</span>
                <h2>{peso(selected.commission_amount)}</h2>
                <p>
                  {affiliateProfile(selectedAffiliate || {}).full_name} • {dateLabel(selected.period_start)} – {dateLabel(selected.period_end)}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>

            <div className="detail-grid">
              <div><span>Saved payout method</span><strong>{selectedPayoutAccount?.payout_method || '—'}</strong></div>
              <div><span>Account name</span><strong>{selectedPayoutAccount?.account_name || '—'}</strong></div>
              <div><span>Account / mobile number</span><strong className="mono">{selectedPayoutAccount?.account_number || '—'}</strong></div>
              <div><span>Bank</span><strong>{selectedPayoutAccount?.bank_name || '—'}</strong></div>
            </div>

            {selectedPayoutAccount?.qr_code_path && (
              <button type="button" className="secondary-btn full payout-qr-btn" onClick={viewSelectedQr}>
                <Eye size={16} /> Open athlete's QR code
              </button>
            )}

            <div className="field-grid two">
              <Field label="Payment method used">
                <select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                  <option>GCash</option><option>Maya</option><option>BDO</option><option>BPI</option><option>UnionBank</option><option>Metrobank</option><option>Other Bank</option>
                </select>
              </Field>
              <Field label="Reference number">
                <input required value={payment.ref} onChange={(e) => setPayment({ ...payment, ref: e.target.value })} />
              </Field>
            </div>

            <Field label="Admin note">
              <textarea rows="3" value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })} />
            </Field>

            <label className="upload-box clickable short">
              {payment.file ? (
                <><CheckCircle2 size={24} /><strong>{payment.file.name}</strong><span>Receipt ready to upload</span></>
              ) : (
                <><Upload size={24} /><strong>Upload payment receipt</strong><span>Required • PNG, JPG or WEBP</span></>
              )}
              <input hidden required type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setPayment({ ...payment, file: e.target.files?.[0] || null })} />
            </label>

            <button className="primary-btn full" disabled={busy}>
              {busy ? <RefreshCw className="spin" size={17} /> : <CheckCircle2 size={18} />}
              Confirm payment & mark paid
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
