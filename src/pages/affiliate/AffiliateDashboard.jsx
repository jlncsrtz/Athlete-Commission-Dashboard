import React, { useMemo, useState } from 'react';
import { BadgeCheck, BarChart3, CalendarDays, CheckCircle2, Clock3, Copy, Package } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import SalesTable from '../../components/sales/SalesTable';
import { orderItems, peso, salesFromOrders } from '../../utils/helpers';

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

export default function AffiliateDashboard({ account, data }) {
  const [dateMode, setDateMode] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const allSales = useMemo(() => salesFromOrders(data.orders), [data.orders]);
  const sales = useMemo(() => allSales.filter((sale) => {
    const saleDate = String(sale.date || '').slice(0, 10);
    if (!saleDate) return false;
    if (dateFrom && saleDate < dateFrom) return false;
    if (dateTo && saleDate > dateTo) return false;
    return true;
  }), [allSales, dateFrom, dateTo]);
  const confirmed = sales.filter((sale) => sale.status === 'confirmed');
  const activeSales = sales.filter((sale) => !['cancelled', 'refunded'].includes(sale.status));
  const totalGmv = activeSales.reduce((sum, sale) => sum + sale.sale, 0);
  const confirmedSalesTotal = confirmed.reduce((sum, sale) => sum + sale.sale, 0);
  const pendingCommission = sales.filter((sale) => sale.status === 'pending').reduce((sum, sale) => sum + sale.commission, 0);
  const approvedCommission = sales.filter((sale) => sale.status === 'approved').reduce((sum, sale) => sum + sale.commission, 0);
  const confirmedCommission = confirmed.reduce((sum, sale) => sum + sale.commission, 0);
  const productsSold = activeSales.reduce((sum, sale) => sum + sale.qty, 0);

  const productMap = {};
  activeSales.forEach((sale) => {
    orderItems(sale.raw).forEach((item) => {
      productMap[item.product_name_snapshot] = (productMap[item.product_name_snapshot] || 0) + Number(item.quantity || 0);
    });
  });
  const topProducts = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <>
      <div className="hero-row">
        <div>
          <span className="eyebrow">ATHLETE'S DASHBOARD</span>
          <h1>Welcome back Athlete, {(account.profile.full_name || 'Athlete').split(' ')[0]}.</h1>
          <p>Track your sales and commission status from Pending to Approved to Confirmed.</p>
        </div>
        <div className="code-card">
          <span>Your athlete's code</span>
          <strong>{account.affiliate.affiliate_code}</strong>
          <button className="icon-btn" onClick={() => navigator.clipboard?.writeText(account.affiliate.affiliate_code)}><Copy size={17} /></button>
        </div>
      </div>

      <div className="dashboard-date-filter athlete-date-filter">
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

      <div className="stats-grid commission-stage-stats athlete-dashboard-stats">
        <StatCard icon={Clock3} label="Pending" value={peso(pendingCommission)} detail="Commission waiting for admin approval" />
        <StatCard icon={BadgeCheck} label="Approved" value={peso(approvedCommission)} detail="Approved and waiting for confirmation" />
        <StatCard icon={CheckCircle2} label="Overall Commission" value={peso(confirmedCommission)} detail="Overall commission earned" />
        <StatCard
          icon={Package}
          label="Total GMV"
          value={`${peso(totalGmv)} / ${productsSold.toLocaleString('en-PH')} sold`}
          detail="Total GMV / total products sold, excluding cancelled/refunded orders"
          accent
        />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="section-title-row"><div><span className="eyebrow">PERFORMANCE</span><h3>Confirmed sales</h3></div><BarChart3 size={20} /></div>
          <div className="simple-metric"><strong>{confirmed.length}</strong><span>confirmed orders</span></div>
          <div className="mini-values"><span>Average confirmed order</span><strong>{peso(confirmed.length ? confirmedSalesTotal / confirmed.length : 0)}</strong></div>
          <div className="mini-values"><span>Commission model</span><strong>Per product</strong></div>
        </div>
        <div className="panel product-panel">
          <div className="section-title-row"><div><span className="eyebrow">PRODUCTS</span><h3>Top products sold</h3></div><Package size={20} /></div>
          {topProducts.length ? topProducts.map(([name, count], index) => (
            <div className="product-row" key={name}><div className="product-meta"><span>{name}</span><strong>{count}</strong></div><div className="progress"><i style={{ width: `${Math.max(12, 100 - index * 20)}%` }} /></div></div>
          )) : <div className="empty">No product sales yet.</div>}
        </div>
      </div>

      <div className="panel">
        <div className="section-title-row"><div><span className="eyebrow">LATEST</span><h3>Recent athlete sales</h3></div></div>
        <SalesTable sales={sales.slice(0, 5)} />
      </div>
    </>
  );
}
