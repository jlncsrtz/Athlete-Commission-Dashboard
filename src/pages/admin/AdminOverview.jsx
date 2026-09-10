import React, { useMemo } from 'react';
import { BadgeDollarSign, Package, Plus, ShoppingBag, Trophy, Users } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { affiliateProfile, orderItems, peso } from '../../utils/helpers';

export default function AdminOverview({ data, onAddSale }) {
  const confirmed = data.orders.filter((order) => order.status === 'confirmed');
  const totalSales = confirmed.reduce((sum, order) => sum + Number(order.final_sale || 0), 0);
  const paidCommission = data.commissions
    .filter((item) => item.payment_status === 'paid')
    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
  const productsSold = confirmed.reduce(
    (sum, order) => sum + orderItems(order).reduce((qty, item) => qty + Number(item.quantity || 0), 0),
    0,
  );

  const athleteLeaderboard = useMemo(() => data.affiliates.map((athlete) => {
    const athleteOrders = confirmed.filter((order) => order.affiliate_id === athlete.id);
    const athleteCommissions = data.commissions.filter((item) => item.affiliate_id === athlete.id);
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
  }).sort((a, b) => b.commission - a.commission), [data, confirmed]);

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

      <div className="stats-grid">
        <StatCard icon={ShoppingBag} label="Confirmed athlete sales" value={peso(totalSales)} accent />
        <StatCard icon={Package} label="Products sold" value={productsSold} />
        <StatCard icon={BadgeDollarSign} label="Direct commission paid" value={peso(paidCommission)} />
        <StatCard icon={Users} label="Athlete accounts" value={data.affiliates.length} />
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
