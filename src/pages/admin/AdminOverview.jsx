import React, { useMemo, useState } from 'react';
import { BadgeCheck, BadgeDollarSign, CalendarDays, CheckCircle2, Clock3, Package, Plus, ShoppingBag, Trophy, Users } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { affiliateProfile, estimatedCommissionFromOrder, orderItems, peso } from '../../utils/helpers';

function localIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function presetRange(mode) {
  const now = new Date();
  const end = localIso(now);
  if (mode === 'today') return { from: end, to: end };
  if (mode === '7d') { const d = new Date(now); d.setDate(d.getDate() - 6); return { from: localIso(d), to: end }; }
  if (mode === '30d') { const d = new Date(now); d.setDate(d.getDate() - 29); return { from: localIso(d), to: end }; }
  if (mode === 'month') return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: end };
  return { from: '', to: '' };
}

export default function AdminOverview({ data, onAddSale }) {
  const [dateMode, setDateMode] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredOrders = useMemo(() => (data.orders || []).filter((order) => {
    const saleDate = String(order.order_date || '').slice(0, 10);
    if (!saleDate) return false;
    if (dateFrom && saleDate < dateFrom) return false;
    if (dateTo && saleDate > dateTo) return false;
    return true;
  }), [data.orders, dateFrom, dateTo]);

  const filteredOrderIds = useMemo(() => new Set(filteredOrders.map((order) => order.id)), [filteredOrders]);
  const filteredCommissions = useMemo(() => (data.commissions || []).filter((item) => filteredOrderIds.has(item.order_id)), [data.commissions, filteredOrderIds]);

  const pending = filteredOrders.filter((order) => order.status === 'pending');
  const approved = filteredOrders.filter((order) => order.status === 'approved');
  const confirmed = filteredOrders.filter((order) => order.status === 'confirmed');

  const pendingCommission = pending.reduce(
    (sum, order) => sum + estimatedCommissionFromOrder(order),
    0,
  );
  const approvedCommission = approved.reduce(
    (sum, order) => sum + estimatedCommissionFromOrder(order),
    0,
  );
  const confirmedCommission = confirmed.reduce(
    (sum, order) => sum + estimatedCommissionFromOrder(order),
    0,
  );

  const totalSales = confirmed.reduce((sum, order) => sum + Number(order.final_sale || 0), 0);
  const totalCommission = filteredCommissions.reduce(
    (sum, item) => sum + Number(item.commission_amount || 0),
    0,
  );
  const pendingAthletes = data.affiliates.filter((athlete) => athlete.status === 'pending').length;
  const productsSold = confirmed.reduce(
    (sum, order) => sum + orderItems(order).reduce((qty, item) => qty + Number(item.quantity || 0), 0),
    0,
  );

  const athleteLeaderboard = useMemo(() => data.affiliates.filter((athlete) => athlete.status === 'approved').map((athlete) => {
    const athleteOrders = confirmed.filter((order) => order.affiliate_id === athlete.id);
    const athleteCommissions = filteredCommissions.filter((item) => item.affiliate_id === athlete.id);
    const commission = athleteCommissions.reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
    const paid = athleteCommissions
      .filter((item) => item.payment_status === 'paid')
      .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
    const sales = athleteOrders.reduce((sum, order) => sum + Number(order.final_sale || 0), 0);
    const products = athleteOrders.reduce(
      (sum, order) => sum + orderItems(order).reduce((qty, item) => qty + Number(item.quantity || 0), 0),
      0,
    );
    return { athlete, commission, paid, sales, products };
  }).sort((a, b) => b.commission - a.commission), [data.affiliates, confirmed, filteredCommissions]);

  const topProducts = useMemo(() => {
    const productMap = new Map();
    confirmed.forEach((order) => {
      orderItems(order).forEach((item) => {
        const name = item.product_name_snapshot || 'Product';
        const current = productMap.get(name) || { name, qty: 0, sales: 0, commission: 0 };
        const qty = Number(item.quantity || 0);
        current.qty += qty;
        current.sales += Number(item.line_total || 0);
        current.commission += qty * Number(item.commission_per_unit_snapshot || 0);
        productMap.set(name, current);
      });
    });
    return [...productMap.values()].sort((a, b) => b.commission - a.commission).slice(0, 6);
  }, [confirmed]);

  return (
    <>
      <PageHeader
        eyebrow="ADMIN CONTROL CENTER"
        title="Athlete sales & direct commissions"
        subtitle="See your highest-performing athletes, direct commissions, and products driving the most commission."
        action={<button className="primary-btn" onClick={onAddSale}><Plus size={17} /> Add athlete sale</button>}
      />

      <div className="dashboard-date-filter">
        <div className="dashboard-date-heading">
          <CalendarDays size={15} />
          <span className="dashboard-date-label">Sales date</span>
        </div>
        <div className="dashboard-date-controls">
          <select
            className="dashboard-date-select"
            aria-label="Sales date range"
            value={dateMode}
            onChange={(event) => {
              const mode = event.target.value;
              setDateMode(mode);
              if (mode !== 'custom') {
                const range = presetRange(mode);
                setDateFrom(range.from);
                setDateTo(range.to);
              }
            }}
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="custom">Custom</option>
          </select>
          {dateMode === 'custom' && (
            <>
              <label className="dashboard-date-inline"><span>From</span><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
              <label className="dashboard-date-inline"><span>To</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
            </>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={ShoppingBag} label="Confirmed athlete sales" value={peso(totalSales)} accent />
        <StatCard icon={Package} label="Products sold" value={productsSold} />
        <StatCard icon={BadgeDollarSign} label="Commission earned" value={peso(totalCommission)} />
        <StatCard icon={Users} label="Athlete accounts" value={data.affiliates.length} detail={pendingAthletes ? `${pendingAthletes} pending approval` : 'No pending applications'} />
      </div>

      <div className="section-title-row admin-workflow-heading">
        <div>
          <span className="eyebrow">COMMISSION WORKFLOW</span>
          <h3>Sales status overview</h3>
        </div>
      </div>

      <div className="stats-grid three admin-workflow-stats">
        <StatCard
          icon={Clock3}
          label="Pending"
          value={pending.length}
          detail={`${peso(pendingCommission)} potential commission`}
        />
        <StatCard
          icon={BadgeCheck}
          label="Approved"
          value={approved.length}
          detail={`${peso(approvedCommission)} approved • auto-confirms next day`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Confirmed"
          value={confirmed.length}
          detail={`${peso(confirmedCommission)} confirmed commission`}
          accent
        />
      </div>

      <div className="panel dashboard-leaderboard-panel">
        <div className="section-title-row">
          <div><span className="eyebrow">ATHLETE RANKING</span><h3>Commission sales leaderboard</h3></div>
          <Trophy size={20} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Rank</th><th>Athlete</th><th>Code</th><th>Sales</th><th>Products</th><th>Commission sales</th><th>Paid</th></tr>
            </thead>
            <tbody>
              {athleteLeaderboard.map((row, index) => (
                <tr key={row.athlete.id}>
                  <td><span className={index < 3 ? 'rank-badge rank-top' : 'rank-badge'}>{index + 1}</span></td>
                  <td><strong>{affiliateProfile(row.athlete).full_name || affiliateProfile(row.athlete).email}</strong></td>
                  <td className="mono">{row.athlete.affiliate_code}</td>
                  <td>{peso(row.sales)}</td>
                  <td>{row.products}</td>
                  <td className="strong-cell leaderboard-commission">{peso(row.commission)}</td>
                  <td>{peso(row.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!athleteLeaderboard.length && <div className="empty">No athlete sales yet.</div>}
        </div>
      </div>

      <div className="panel dashboard-products-panel">
        <div className="section-title-row">
          <div><span className="eyebrow">PRODUCT PERFORMANCE</span><h3>Products driving the most commission</h3></div>
          <Package size={20} />
        </div>
        {topProducts.length ? (
          <div className="dashboard-product-list">
            {topProducts.map((product, index) => (
              <div className="dashboard-product-row" key={product.name}>
                <span className="dashboard-product-rank">#{index + 1}</span>
                <div className="dashboard-product-copy">
                  <strong>{product.name}</strong>
                  <span>{product.qty} sold • {peso(product.sales)} sales</span>
                </div>
                <div className="dashboard-product-commission">
                  <span>Commission</span>
                  <strong>{peso(product.commission)}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="empty">No confirmed product sales yet.</div>}
      </div>
    </>
  );
}
