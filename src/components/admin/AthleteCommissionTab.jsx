import React, { useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Eye, ImagePlus, X } from 'lucide-react';
import {
  adminPaySelectedCommissions,
  adminUpdateOrderStatus,
  signedImage,
  uploadBatchPayoutReceipt,
} from '../../api';
import Field from '../common/Field';
import FormAlertModal from '../common/FormAlertModal';
import Modal from '../common/Modal';
import StatusPill from '../common/StatusPill';
import {
  dateLabel,
  orderCommission,
  payoutAccount,
  peso,
  salesFromOrders,
} from '../../utils/helpers';

function paymentIsDone(sale) {
  const commission = orderCommission(sale?.raw);
  return String(sale?.paymentStatus || '').toLowerCase() === 'paid' || Boolean(commission?.payout_id);
}

function statusLabel(status) {
  if (status === 'confirmed') return 'Confirmed / Completed';
  if (status === 'approved') return 'Approved';
  if (status === 'pending') return 'Pending';
  if (status === 'cancelled') return 'Cancelled';
  return status || '—';
}

export default function AthleteCommissionTab({ athlete, data, onRefresh }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewReceiptUrl, setReviewReceiptUrl] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payment, setPayment] = useState({ method: '', ref: '', receipt: null });
  const [qrUrl, setQrUrl] = useState('');
  const [alert, setAlert] = useState({ open: false, title: '', errors: [] });
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  const payout = payoutAccount(athlete || {});
  const sales = useMemo(
    () => salesFromOrders((data.orders || []).filter((order) => order.affiliate_id === athlete.id)),
    [data.orders, athlete.id],
  );

  const filteredSales = useMemo(
    () => (statusFilter === 'all' ? sales : sales.filter((sale) => sale.status === statusFilter)),
    [sales, statusFilter],
  );

  const selectedSales = useMemo(
    () => sales.filter((sale) => selectedIds.includes(sale.raw.id) && sale.status === 'pending' && !paymentIsDone(sale)),
    [sales, selectedIds],
  );

  const selectedTotal = selectedSales.reduce((sum, sale) => sum + Number(sale.commission || 0), 0);
  const selectableSales = filteredSales.filter((sale) => sale.status === 'pending' && !paymentIsDone(sale));
  const allSelectableChecked = selectableSales.length > 0 && selectableSales.every((sale) => selectedIds.includes(sale.raw.id));

  function toggleOrder(orderId, checked) {
    setSelectedIds((current) => {
      if (checked) return current.includes(orderId) ? current : [...current, orderId];
      return current.filter((id) => id !== orderId);
    });
  }

  function toggleAll(checked) {
    const visiblePendingIds = selectableSales.map((sale) => sale.raw.id);
    setSelectedIds((current) => {
      if (checked) return Array.from(new Set([...current, ...visiblePendingIds]));
      return current.filter((id) => !visiblePendingIds.includes(id));
    });
  }

  async function updateStatus(sale, nextStatus) {
    if (nextStatus === sale.status) return;

    setBusyId(sale.raw.id);
    try {
      await adminUpdateOrderStatus(sale.raw.id, nextStatus);
      setSelectedIds((current) => current.filter((id) => id !== sale.raw.id));
      await onRefresh();
    } catch (error) {
      setAlert({
        open: true,
        title: 'Status update failed',
        errors: [error?.message || 'The sale status could not be updated.'],
      });
    } finally {
      setBusyId(null);
    }
  }

  async function openPayment() {
    if (!selectedSales.length) {
      setAlert({ open: true, title: 'Select commissions first', errors: ['Check at least one Pending commission to pay.'] });
      return;
    }

    setPayment({ method: payout?.payout_method || 'GCash', ref: '', receipt: null });
    setQrUrl('');
    setPayOpen(true);

    if (payout?.qr_code_path) {
      try {
        setQrUrl((await signedImage('affiliate-qr', payout.qr_code_path)) || '');
      } catch {
        setQrUrl('');
      }
    }
  }

  function closeReview() {
    if (reviewReceiptUrl) URL.revokeObjectURL(reviewReceiptUrl);
    setReviewReceiptUrl('');
    setReviewOpen(false);
  }

  function reviewPayment(event) {
    event.preventDefault();
    if (!payment.receipt) {
      setAlert({
        open: true,
        title: 'Receipt required',
        errors: ['Upload the payment receipt before reviewing this batch payment.'],
      });
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(payment.receipt.type)) {
      setAlert({ open: true, title: 'Invalid receipt image', errors: ['Receipt must be a JPG, PNG, or WEBP image.'] });
      return;
    }
    if (payment.receipt.size > 8 * 1024 * 1024) {
      setAlert({ open: true, title: 'Receipt is too large', errors: ['Receipt image must be 8 MB or smaller.'] });
      return;
    }
    if (!athlete?.user_id) {
      setAlert({ open: true, title: 'Athlete account missing', errors: ['This athlete does not have a valid user account.'] });
      return;
    }
    if (!selectedSales.length) {
      setAlert({ open: true, title: 'No Pending commissions selected', errors: ['Select at least one Pending commission to pay.'] });
      return;
    }

    if (reviewReceiptUrl) URL.revokeObjectURL(reviewReceiptUrl);
    setReviewReceiptUrl(URL.createObjectURL(payment.receipt));
    setReviewOpen(true);
  }

  async function confirmPayment() {
    if (!payment.receipt || !selectedSales.length) return;

    const paidCount = selectedSales.length;
    const paidTotal = selectedTotal;
    const paymentMethod = payment.method;
    const paymentRef = payment.ref?.trim() || '';

    setPayBusy(true);
    try {
      const receiptPath = await uploadBatchPayoutReceipt(athlete.user_id, payment.receipt);
      await adminPaySelectedCommissions(
        athlete.id,
        selectedSales.map((sale) => sale.raw.id),
        payment,
        receiptPath,
      );

      setSelectedIds([]);
      setStatusFilter('approved');
      setPaymentSuccess({
        count: paidCount,
        total: paidTotal,
        method: paymentMethod,
        ref: paymentRef,
        receiptPath,
      });
      closeReview();
      setPayOpen(false);
      await onRefresh();
    } catch (error) {
      setAlert({
        open: true,
        title: 'Batch payment failed',
        errors: [error?.message || 'The selected commissions could not be paid.'],
      });
    } finally {
      setPayBusy(false);
    }
  }

  async function viewReceipt(path) {
    try {
      const url = await signedImage('payout-receipts', path);
      if (!url) throw new Error('Receipt is not available.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setAlert({ open: true, title: 'Receipt unavailable', errors: [error?.message || 'Unable to open the receipt.'] });
    }
  }

  return (
    <>
      <div className="athlete-commission-toolbar">
        <div>
          <strong>Commission / Sales Status</strong>
          <span>Only Pending commissions can be checked for Pay selected. After payment they become Paid + Approved, then you can still update the order status later.</span>
        </div>
        <div className="athlete-commission-actions">
          <label className="commission-status-filter">
            <span>Filter status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="confirmed">Confirmed / Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <div className="selected-commission-total">
            <span>{selectedSales.length} selected</span>
            <strong>{peso(selectedTotal)}</strong>
            <button type="button" className="primary-btn small" disabled={!selectedSales.length} onClick={openPayment}>
              <CreditCard size={15} /> Pay selected
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap athlete-commission-table-wrap">
        <table className="athlete-commission-table">
          <thead>
            <tr>
              <th className="select-cell">
                <input
                  type="checkbox"
                  aria-label="Select all visible pending commissions"
                  checked={allSelectableChecked}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </th>
              <th>Order</th>
              <th>Date</th>
              <th>Products</th>
              <th>Commission</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((sale) => {
              const paid = paymentIsDone(sale);
              const canSelect = sale.status === 'pending' && !paid;
              return (
                <tr key={sale.raw.id}>
                  <td className="select-cell">
                    <input
                      type="checkbox"
                      aria-label={`Select order ${sale.id}`}
                      disabled={!canSelect}
                      checked={selectedIds.includes(sale.raw.id)}
                      onChange={(event) => toggleOrder(sale.raw.id, event.target.checked)}
                    />
                  </td>
                  <td className="mono">#{sale.id}</td>
                  <td>{dateLabel(sale.date)}</td>
                  <td>
                    <strong>{sale.product}</strong>
                    <small className="subcell">Qty {sale.qty}</small>
                  </td>
                  <td className="strong-cell">{peso(sale.commission)}</td>
                  <td>
                    <select
                      className={`status-select athlete-status-select status-${sale.status}`}
                      value={sale.status}
                      disabled={busyId === sale.raw.id}
                      onChange={(event) => updateStatus(sale, event.target.value)}
                      aria-label={`Status for order ${sale.id}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="confirmed">Confirmed / Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <small className={`subcell status-helper status-text-${sale.status}`}>{statusLabel(sale.status)}</small>
                  </td>
                  <td>{paid ? <StatusPill status="paid" /> : <span className="payment-not-paid">Not paid</span>}</td>
                  <td>
                    {sale.receiptPath ? (
                      <button type="button" className="secondary-btn tiny" onClick={() => viewReceipt(sale.receiptPath)}>
                        <Eye size={14} /> View
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!sales.length && <div className="empty">No sales have been added for this athlete yet.</div>}
        {sales.length > 0 && !filteredSales.length && <div className="empty">No {statusFilter} sales found for this athlete.</div>}
      </div>

      {payOpen && (
        <Modal onClose={() => !payBusy && setPayOpen(false)} className="modal-xlarge batch-payment-modal">
          <form className="modal-form" onSubmit={reviewPayment}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">BATCH COMMISSION PAYMENT</span>
                <h2>Pay {selectedSales.length} selected commission{selectedSales.length === 1 ? '' : 's'}</h2>
                <p>Only selected Pending sales are included. You will review the receipt and total before the payment is saved.</p>
              </div>
              <button type="button" className="icon-btn" disabled={payBusy} onClick={() => setPayOpen(false)}><X size={18} /></button>
            </div>

            <div className="batch-payment-grid">
              <div className="batch-payment-main">
                <div className="batch-total-card">
                  <span>Total commission to pay</span>
                  <strong>{peso(selectedTotal)}</strong>
                  <small>{selectedSales.length} selected sale{selectedSales.length === 1 ? '' : 's'}</small>
                </div>

                <div className="batch-selected-list">
                  {selectedSales.map((sale) => (
                    <div key={sale.raw.id} className="batch-selected-row">
                      <div>
                        <strong>#{sale.id}</strong>
                        <span>{sale.product}</span>
                      </div>
                      <div>
                        <small>{statusLabel(sale.status)}</small>
                        <strong>{peso(sale.commission)}</strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="field-grid two batch-payment-fields">
                  <Field label="Mode of payment">
                    <select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}>
                      <option>GCash</option><option>Maya</option><option>MariBank</option><option>GoTyme Bank</option><option>BDO</option><option>BPI</option><option>UnionBank</option><option>Metrobank</option><option>Other Bank</option>
                    </select>
                  </Field>
                  <Field label="Reference number (optional)">
                    <input value={payment.ref} onChange={(event) => setPayment({ ...payment, ref: event.target.value })} placeholder="Payment reference" />
                  </Field>
                </div>

                <Field label="Payment receipt (required)">
                  <label className="batch-receipt-upload">
                    <ImagePlus size={18} />
                    <div>
                      <strong>{payment.receipt?.name || 'Choose receipt image'}</strong>
                      <span>JPG, PNG, or WEBP · up to 8 MB</span>
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => setPayment({ ...payment, receipt: event.target.files?.[0] || null })}
                    />
                  </label>
                </Field>

                <button type="submit" className="primary-btn full" disabled={payBusy}>
                  <Eye size={16} /> Review payment
                </button>
              </div>

              <aside className="athlete-payout-preview batch-payout-preview">
                <div className="payout-preview-title">
                  <CreditCard size={18} />
                  <div><span className="eyebrow">ATHLETE PAYMENT DETAILS</span><strong>{payout?.payout_method || 'No payout method'}</strong></div>
                </div>
                {qrUrl ? <div className="qr-preview-box"><img src={qrUrl} alt="Athlete payout QR" /></div> : <div className="qr-preview-box"><span>No QR image saved</span></div>}
                <div className="payout-preview-details compact-details">
                  <div><span>Account name</span><strong>{payout?.account_name || '—'}</strong></div>
                  <div><span>Account number</span><strong className="mono">{payout?.account_number || '—'}</strong></div>
                  <div><span>Bank</span><strong>{payout?.bank_name || '—'}</strong></div>
                </div>
              </aside>
            </div>
          </form>
        </Modal>
      )}

      {reviewOpen && (
        <Modal onClose={() => !payBusy && closeReview()} className="payment-review-modal">
          <div className="modal-head">
            <div>
              <span className="eyebrow">CONFIRM PAYMENT</span>
              <h2>Check the payment receipt</h2>
              <p>If everything below is correct, confirm the payment. The selected commissions will be marked Paid and their order status will become Approved.</p>
            </div>
            <button type="button" className="icon-btn" disabled={payBusy} onClick={closeReview}><X size={18} /></button>
          </div>

          <div className="payment-review-layout">
            <div className="payment-review-receipt">
              <span>Receipt preview</span>
              {reviewReceiptUrl ? <img src={reviewReceiptUrl} alt="Payment receipt preview" /> : <div>No receipt preview</div>}
            </div>

            <div className="payment-review-summary">
              <div className="batch-total-card">
                <span>Total commission</span>
                <strong>{peso(selectedTotal)}</strong>
                <small>{selectedSales.length} selected Pending commission{selectedSales.length === 1 ? '' : 's'}</small>
              </div>
              <div className="payment-review-details">
                <div><span>Payment method</span><strong>{payment.method || '—'}</strong></div>
                <div><span>Reference number</span><strong className="mono">{payment.ref?.trim() || '—'}</strong></div>
                <div><span>After payment</span><strong className="status-text-approved">Approved + Paid</strong></div>
              </div>
              <div className="batch-selected-list payment-review-orders">
                {selectedSales.map((sale) => (
                  <div key={sale.raw.id} className="batch-selected-row">
                    <div><strong>#{sale.id}</strong><span>{sale.product}</span></div>
                    <div><small>Pending → Approved</small><strong>{peso(sale.commission)}</strong></div>
                  </div>
                ))}
              </div>
              <p className="payment-review-note">After it is paid, the status dropdown stays editable. You can later change Approved to Confirmed / Completed according to the normal workflow.</p>
            </div>
          </div>

          <div className="payment-review-actions">
            <button type="button" className="secondary-btn" disabled={payBusy} onClick={closeReview}>Back and edit</button>
            <button type="button" className="primary-btn" disabled={payBusy} onClick={confirmPayment}>
              <CreditCard size={16} /> {payBusy ? 'Saving payment...' : `Confirm payment · ${peso(selectedTotal)}`}
            </button>
          </div>
        </Modal>
      )}

      {paymentSuccess && (
        <Modal onClose={() => setPaymentSuccess(null)} className="payment-success-modal">
          <div className="payment-success-card">
            <span className="payment-success-icon"><CheckCircle2 size={26} /></span>
            <span className="eyebrow">PAYMENT SAVED</span>
            <h2>{paymentSuccess.count} commission{paymentSuccess.count === 1 ? '' : 's'} paid</h2>
            <strong>{peso(paymentSuccess.total)}</strong>
            <p>The selected orders are now <b>Approved</b> and the payment is recorded as <b>Paid</b>. Their status can still be updated later.</p>
            <div className="payment-success-details">
              <div><span>Payment method</span><strong>{paymentSuccess.method || '—'}</strong></div>
              <div><span>Reference</span><strong className="mono">{paymentSuccess.ref || '—'}</strong></div>
            </div>
            <div className="payment-success-actions">
              <button type="button" className="secondary-btn" onClick={() => viewReceipt(paymentSuccess.receiptPath)}><Eye size={15} /> View saved receipt</button>
              <button type="button" className="primary-btn" onClick={() => setPaymentSuccess(null)}>Done</button>
            </div>
          </div>
        </Modal>
      )}

      <FormAlertModal
        open={alert.open}
        title={alert.title || 'Unable to continue'}
        errors={alert.errors}
        onClose={() => setAlert({ open: false, title: '', errors: [] })}
      />
    </>
  );
}
