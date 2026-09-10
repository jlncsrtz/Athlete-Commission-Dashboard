import React from 'react';
import { BarChart3, CircleDollarSign, Copy, Package, ShoppingBag } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import SalesTable from '../../components/sales/SalesTable';
import { orderItems, peso, salesFromOrders } from '../../utils/helpers';

export default function AffiliateDashboard({ account, data }) {
  const sales = salesFromOrders(data.orders);
  const confirmed = sales.filter((sale) => sale.status === 'confirmed');
  const salesTotal = confirmed.reduce((sum, sale) => sum + sale.sale, 0);
  const qty = confirmed.reduce((sum, sale) => sum + sale.qty, 0);
  const commission = confirmed.reduce((sum, sale) => sum + sale.commission, 0);
  const productMap = {};
  confirmed.forEach((sale) => {
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
          <p>Track your real sales, product commissions, and direct payment status.</p>
        </div>
        <div className="code-card">
          <span>Your athlete's code</span>
          <strong>{account.affiliate.affiliate_code}</strong>
          <button className="icon-btn" onClick={() => navigator.clipboard?.writeText(account.affiliate.affiliate_code)}><Copy size={17} /></button>
        </div>
      </div>

      <div className="stats-grid three">
        <StatCard icon={ShoppingBag} label="Confirmed sales" value={peso(salesTotal)} detail="Lifetime attributed sales" accent />
        <StatCard icon={Package} label="Products sold" value={qty} detail="Confirmed orders" />
        <StatCard icon={CircleDollarSign} label="Commission earned" value={peso(commission)} detail="Based on product commission amounts" />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="section-title-row"><div><span className="eyebrow">PERFORMANCE</span><h3>Recent sales</h3></div><BarChart3 size={20} /></div>
          <div className="simple-metric"><strong>{confirmed.length}</strong><span>confirmed orders</span></div>
          <div className="mini-values"><span>Average order</span><strong>{peso(confirmed.length ? salesTotal / confirmed.length : 0)}</strong></div>
          <div className="mini-values"><span>Commission model</span><strong>Per product</strong></div>
        </div>
        <div className="panel product-panel">
          <div className="section-title-row"><div><span className="eyebrow">PRODUCTS</span><h3>Top products sold</h3></div><Package size={20} /></div>
          {topProducts.length ? topProducts.map(([name, count], index) => (
            <div className="product-row" key={name}><div className="product-meta"><span>{name}</span><strong>{count}</strong></div><div className="progress"><i style={{ width: `${Math.max(12, 100 - index * 20)}%` }} /></div></div>
          )) : <div className="empty">No confirmed product sales yet.</div>}
        </div>
      </div>

      <div className="panel">
        <div className="section-title-row"><div><span className="eyebrow">LATEST</span><h3>Recent athlete sales</h3></div></div>
        <SalesTable sales={sales.slice(0, 5)} />
      </div>
    </>
  );
}
