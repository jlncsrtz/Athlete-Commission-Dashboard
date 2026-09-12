import React, { useMemo, useState } from 'react';
import { CreditCard, Eye, Filter, ImagePlus, Plus, RefreshCw, Search, X } from 'lucide-react';
import { adminApproveOrderWithPayment, adminUpdateOrderStatus, signedImage, uploadCommissionReceipt } from '../../api';
import FormAlertModal from '../../components/common/FormAlertModal';
import Field from '../../components/common/Field';
import Modal from '../../components/common/Modal';
import PageHeader from '../../components/common/PageHeader';
import { affiliateProfile, dateLabel, payoutAccount, peso, salesFromOrders } from '../../utils/helpers';

export default function AdminOrders({ data, onRefresh, onAddSale }) {
  const [busyId, setBusyId] = useState(null);
  const [statusAlert, setStatusAlert] = useState({ open: false, title: '', errors: [] });
  const [athleteQuery, setAthleteQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [approvalSale, setApprovalSale] = useState(null);
  const [approvalPayment, setApprovalPayment] = useState({ method: 'GCash', ref: '', receipt: null });
  const [approvalQrUrl, setApprovalQrUrl] = useState('');
  const [approvalBusy, setApprovalBusy] = useState(false);

  const sales = useMemo(
    () => salesFromOrders(data.orders).map((sale) => ({
      ...sale,
      affiliate: data.affiliates.find((athlete) => athlete.id === sale.raw.affiliate_id),
    })),
    [data.orders, data.affiliates],
  );

  const categories = useMemo(
    () => [...new Set(sales.map((sale) => sale.category).filter(Boolean))].sort(),
    [sales],
  );

  const filtered = useMemo(() => sales.filter((sale) => {
    const profile = affiliateProfile(sale.affiliate || {});
    const athleteText = `${profile.full_name} ${profile.email} ${sale.affiliate?.affiliate_code || ''}`.toLowerCase();
    const productText = `${sale.product} ${sale.category || ''}`.toLowerCase();
    return (
      (!athleteQuery.trim() || athleteText.includes(athleteQuery.trim().toLowerCase())) &&
      (!productQuery.trim() || productText.includes(productQuery.trim().toLowerCase())) &&
      (status === 'all' || sale.status === status) &&
      (category === 'all' || sale.category === category)
    );
  }), [sales, athleteQuery, productQuery, status, category]);

  function transitionError(sale, value) {
    const current = sale.status;
    if (value === current) return '';

    if (current === 'pending') {
      if (!['approved', 'confirmed', 'cancelled'].includes(value)) {
        return 'Pending sales can only move to Approved, Confirmed, or Cancelled.';
      }
    }

    if (current === 'approved') {
      if (value === 'pending') {
        return 'Approved sales cannot move backward to Pending.';
      }
      if (!['confirmed', 'cancelled'].includes(value)) {
        return 'Approved sales can only move to Confirmed or Cancelled.';
      }
    }

    if (current === 'confirmed') {
      return 'Confirmed commission is already earned and cannot be moved backward or cancelled.';
    }

    if (current === 'cancelled') {
      return 'Cancelled orders are final and cannot re-enter the commission workflow.';
    }

    return '';
  }

  async function openApprovalPayment(sale) {
    const payout = payoutAccount(sale.affiliate || {});
    setApprovalSale(sale);
    setApprovalPayment({
      method: payout?.payout_method || 'GCash',
      ref: '',
      receipt: null,
    });
    setApprovalQrUrl('');

    if (payout?.qr_code_path) {
      try {
        const url = await signedImage('affiliate-qr', payout.qr_code_path);
        setApprovalQrUrl(url || '');
      } catch {
        setApprovalQrUrl('');
      }
    }
  }

  async function saveApprovedPayment(event) {
    event.preventDefault();
    if (!approvalSale) return;
    if (!approvalPayment.receipt) {
      setStatusAlert({
        open: true,
        title: 'Payment receipt required',
        errors: ['Upload the payment receipt / QR proof before approving this sale.'],
      });
      return;
    }

    const athlete = approvalSale.affiliate;
    if (!athlete?.user_id) {
      setStatusAlert({
        open: true,
        title: 'Athlete account missing',
        errors: ['The selected athlete does not have a valid user account for receipt storage.'],
      });
      return;
    }

    setApprovalBusy(true);
    try {
      const receiptPath = await uploadCommissionReceipt(
        athlete.user_id,
        approvalSale.raw.id,
        approvalPayment.receipt,
      );
      await adminApproveOrderWithPayment(approvalSale.raw.id, approvalPayment, receiptPath);
      setApprovalSale(null);
      await onRefresh();
    } catch (err) {
      setStatusAlert({
        open: true,
        title: 'Unable to approve sale',
        errors: [err?.message || 'The sale could not be approved with its payment details.'],
      });
    } finally {
      setApprovalBusy(false);
    }
  }

  async function updateStatus(sale, value) {
    if (value === 'approved' && sale.status === 'pending') {
      await openApprovalPayment(sale);
      return;
    }

    const validationMessage = transitionError(sale, value);
    if (validationMessage) {
      setStatusAlert({
        open: true,
        title: 'Status update not allowed',
        errors: [validationMessage],
      });
      return;
    }

    if (value === sale.status) return;

    setBusyId(sale.raw.id);
    try {
      await adminUpdateOrderStatus(sale.raw.id, value);
      await onRefresh();
    } catch (err) {
      setStatusAlert({
        open: true,
        title: 'Status update failed',
        errors: [err?.message || 'The order status could not be updated.'],
      });
    } finally {
      setBusyId(null);
    }
  }

  function clearFilters() {
    setAthleteQuery('');
    setProductQuery('');
    setStatus('all');
    setCategory('all');
  }

  const hasFilters = athleteQuery || productQuery || status !== 'all' || category !== 'all';

  return (
    <>
      <PageHeader
        eyebrow="ORDERS"
        title="Athlete sales"
        subtitle="Approved sales automatically become Confirmed the next day. Admin can also manually select Confirmed anytime."
        action={<button className="primary-btn" onClick={onAddSale}><Plus size={17} /> Add sale</button>}
      />


      <div className="panel sales-filter-panel">
        <div className="sales-filter-title">
          <div><Filter size={17} /><strong>Filter athlete sales</strong></div>
          <span>{filtered.length} of {sales.length} sales</span>
        </div>
        <div className="sales-filter-grid">
          <div className="search filter-search">
            <Search size={16} />
            <input placeholder="Search athlete name or code" value={athleteQuery} onChange={(event) => setAthleteQuery(event.target.value)} />
          </div>
          <div className="search filter-search">
            <Search size={16} />
            <input placeholder="Search product" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} />
          </div>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {hasFilters && (
            <button type="button" className="secondary-btn clear-filter-btn" onClick={clearFilters}>
              <X size={15} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th><th>Athlete</th><th>Date</th><th>Product</th><th>Category</th><th>Qty</th><th>Sale</th><th>Commission</th><th>Order status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sale) => {
                return (
                  <tr key={sale.raw.id}>
                    <td className="mono">#{sale.id}</td>
                    <td>
                      <strong>{affiliateProfile(sale.affiliate || {}).full_name}</strong>
                      <small className="subcell">{sale.affiliate?.affiliate_code || ''}</small>
                    </td>
                    <td>{dateLabel(sale.date)}</td>
                    <td>{sale.product}</td>
                    <td>{sale.category || 'Uncategorized'}</td>
                    <td>{sale.qty}</td>
                    <td>{peso(sale.sale)}</td>
                    <td>{peso(sale.commission)}</td>
                    <td>
                      <div className="order-status-control">
                        <select
                          className="status-select order-status-select"
                          value={sale.status}
                          disabled={busyId === sale.raw.id}
                          onChange={(event) => updateStatus(sale, event.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        {sale.status === 'approved' && <small>Auto-confirms next day. Manual Confirmed is also allowed.</small>}
                        {sale.status === 'confirmed' && <small>Commission is confirmed.</small>}
                        {sale.status === 'cancelled' && <small>Cancelled orders are final.</small>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div className="empty">No athlete sales match your filters.</div>}
        </div>
      </div>

      {approvalSale && (() => {
        const athlete = approvalSale.affiliate || {};
        const payout = payoutAccount(athlete);
        const profile = affiliateProfile(athlete);

        return (
          <Modal onClose={() => !approvalBusy && setApprovalSale(null)} className="modal-xlarge add-sale-modal approval-payment-modal">
            <form onSubmit={saveApprovedPayment} className="modal-form">
              <div className="modal-head">
                <div>
                  <span className="eyebrow">APPROVE COMMISSION</span>
                  <h2>Send payment details</h2>
                  <p>Enter the payment details and receipt before setting this sale to Approved.</p>
                </div>
                <button type="button" className="icon-btn" disabled={approvalBusy} onClick={() => setApprovalSale(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="add-sale-layout compact-payment-layout">
                <div className="add-sale-main">
                  <div className="panel-lite">
                    <strong>Order #{approvalSale.id}</strong>
                    <span>{profile.full_name || 'Athlete'} · {approvalSale.product} · {peso(approvalSale.commission)} commission</span>
                  </div>

                  <div className="field-grid three direct-payment-fields">
                    <Field label="Mode of payment">
                      <select
                        value={approvalPayment.method}
                        onChange={(event) => setApprovalPayment({ ...approvalPayment, method: event.target.value })}
                      >
                        <option>GCash</option><option>Maya</option><option>MariBank</option><option>GoTyme Bank</option><option>BDO</option><option>BPI</option><option>UnionBank</option><option>Metrobank</option><option>Other Bank</option>
                      </select>
                    </Field>

                    <Field label="Reference number (optional)">
                      <input
                        value={approvalPayment.ref}
                        onChange={(event) => setApprovalPayment({ ...approvalPayment, ref: event.target.value })}
                        placeholder="Payment reference (optional)"
                      />
                    </Field>

                    <Field label="Payment receipt / QR proof (required)">
                      <label className="file-inline-btn">
                        <ImagePlus size={15} />
                        {approvalPayment.receipt ? approvalPayment.receipt.name : 'Choose image'}
                        <input
                          hidden
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) => setApprovalPayment({
                            ...approvalPayment,
                            receipt: event.target.files?.[0] || null,
                          })}
                        />
                      </label>
                    </Field>
                  </div>

                  <button className="primary-btn full" disabled={approvalBusy}>
                    {approvalBusy ? <RefreshCw className="spin" size={17} /> : <CreditCard size={17} />}
                    Approve & save payment
                  </button>
                </div>

                <aside className="athlete-payout-preview compact-payout-preview">
                  <div className="payout-preview-title">
                    <CreditCard size={18} />
                    <div>
                      <span className="eyebrow">ATHLETE PAYMENT DETAILS</span>
                      <strong>{profile.full_name || 'Athlete'}</strong>
                    </div>
                  </div>

                  <div className="qr-preview-box inline-athlete-qr">
                    {approvalQrUrl ? (
                      <img src={approvalQrUrl} alt="Athlete payment QR" />
                    ) : (
                      <div className="qr-placeholder"><CreditCard size={24} /><span>No QR uploaded</span></div>
                    )}
                  </div>

                  {approvalQrUrl && (
                    <a className="secondary-btn full view-qr-popup-btn" href={approvalQrUrl} target="_blank" rel="noreferrer">
                      <Eye size={16} /> View QR code
                    </a>
                  )}

                  <div className="payout-preview-details compact-details">
                    <div><span>Method</span><strong>{payout?.payout_method || '—'}</strong></div>
                    <div><span>Account name</span><strong>{payout?.account_name || '—'}</strong></div>
                    <div><span>Account number</span><strong className="mono">{payout?.account_number || '—'}</strong></div>
                    <div><span>Bank</span><strong>{payout?.bank_name || '—'}</strong></div>
                  </div>
                </aside>
              </div>
            </form>
          </Modal>
        );
      })()}

      <FormAlertModal
        open={statusAlert.open}
        title={statusAlert.title || 'Status update not allowed'}
        errors={statusAlert.errors}
        onClose={() => setStatusAlert({ open: false, title: '', errors: [] })}
      />
    </>
  );
}
