import React, { useMemo, useState } from 'react';
import { Filter, Plus, Search, X } from 'lucide-react';
import { adminUpdateOrderStatus } from '../../api';
import FormAlertModal from '../../components/common/FormAlertModal';
import PageHeader from '../../components/common/PageHeader';
import { affiliateProfile, canConfirmApprovedSale, dateLabel, peso, salesFromOrders } from '../../utils/helpers';

export default function AdminOrders({ data, onRefresh, onAddSale }) {
  const [busyId, setBusyId] = useState(null);
  const [statusAlert, setStatusAlert] = useState({ open: false, title: '', errors: [] });
  const [athleteQuery, setAthleteQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');

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
      if (value === 'confirmed') {
        return 'You cannot skip Approved. Move this sale from Pending to Approved first, then Confirmed becomes available starting the next calendar day.';
      }
      if (!['approved', 'cancelled'].includes(value)) {
        return 'Pending sales can only move to Approved or Cancelled.';
      }
    }

    if (current === 'approved') {
      if (value === 'pending') {
        return 'Approved sales cannot move backward to Pending.';
      }
      if (value === 'confirmed' && !canConfirmApprovedSale(sale)) {
        return 'This sale was approved today. Confirmed / Commission Earned becomes available starting tomorrow.';
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

  async function updateStatus(sale, value) {
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
        subtitle="Order status workflow: Pending → Approved → Confirmed. Confirmed becomes available starting the next calendar day after approval."
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
                const confirmLocked = sale.status === 'approved' && !canConfirmApprovedSale(sale);
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
                        {confirmLocked && <small>Confirmed is available tomorrow.</small>}
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

      <FormAlertModal
        open={statusAlert.open}
        title={statusAlert.title || 'Status update not allowed'}
        errors={statusAlert.errors}
        onClose={() => setStatusAlert({ open: false, title: '', errors: [] })}
      />
    </>
  );
}
