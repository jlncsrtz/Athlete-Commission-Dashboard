import React from 'react';
import { BadgeCheck, BarChart3, CheckCircle2, Clock3, Copy, Package } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import SalesTable from '../../components/sales/SalesTable';
import { orderItems, peso, salesFromOrders } from '../../utils/helpers';

export default function AffiliateDashboard({ account, data }) {
  const sales = salesFromOrders(data.orders);
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
