import React, { useMemo, useState } from 'react';
import { Filter, Plus, Search, X } from 'lucide-react';
import { adminUpdateOrderStatus } from '../../api';
import Notice from '../../components/common/Notice';
import PageHeader from '../../components/common/PageHeader';
import StatusPill from '../../components/common/StatusPill';
import { affiliateProfile, dateLabel, peso, salesFromOrders } from '../../utils/helpers';

export default function AdminOrders({ data, onRefresh, onAddSale }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
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

  async function updateStatus(id, value) {
    setBusyId(id);
    setError('');
    try {
      await adminUpdateOrderStatus(id, value);
      await onRefresh();
    } catch (err) {
      setError(err.message);
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
        subtitle="Search athletes, products, categories, and order status."
        action={<button className="primary-btn" onClick={onAddSale}><Plus size={17} /> Add sale</button>}
      />

      {error && <Notice type="error">{error}</Notice>}

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
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
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
                <th>Order</th><th>Athlete</th><th>Date</th><th>Product</th><th>Category</th><th>Qty</th><th>Sale</th><th>Commission</th><th>Payment</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sale) => (
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
                  <td><StatusPill status={sale.paymentStatus || 'unpaid'} /></td>
                  <td>
                    {sale.status === 'refunded' ? (
                      <StatusPill status="refunded" />
                    ) : (
                      <select
                        disabled={busyId === sale.raw.id}
                        className="status-select"
                        value={sale.status}
                        onChange={(event) => updateStatus(sale.raw.id, event.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div className="empty">No athlete sales match your filters.</div>}
        </div>
      </div>
    </>
  );
}
