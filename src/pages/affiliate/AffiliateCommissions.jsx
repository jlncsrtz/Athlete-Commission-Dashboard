import React from 'react';
import { BadgeDollarSign, CheckCircle2, Eye, ReceiptText, Wallet } from 'lucide-react';
import { signedImage } from '../../api';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusPill from '../../components/common/StatusPill';
import { dateLabel, peso, salesFromOrders } from '../../utils/helpers';

export default function AffiliateCommissions({ orders }) {
  const sales = salesFromOrders(orders).filter((sale) => sale.status === 'confirmed');
  const total = sales.reduce((sum, sale) => sum + Number(sale.commission || 0), 0);
  const paid = sales
    .filter((sale) => sale.paymentStatus === 'paid')
    .reduce((sum, sale) => sum + Number(sale.commission || 0), 0);

  async function viewReceipt(sale) {
    if (!sale.receiptPath) return;
    const url = await signedImage('payout-receipts', sale.receiptPath);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <PageHeader
        eyebrow="COMMISSIONS"
        title="Commission history"
        subtitle="See the commission for each confirmed sale and whether it was paid directly."
      />
      <div className="stats-grid three">
        <StatCard icon={BadgeDollarSign} label="Commission earned" value={peso(total)} accent />
        <StatCard icon={CheckCircle2} label="Total paid" value={peso(paid)} />
        <StatCard icon={Wallet} label="Paid sales" value={sales.filter((sale) => sale.paymentStatus === 'paid').length} />
      </div>
      <div className="panel">
        <div className="section-title-row">
          <div><span className="eyebrow">DIRECT PAYMENTS</span><h3>Commission by sale</h3></div>
          <ReceiptText size={20} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Date</th><th>Product</th><th>Commission</th><th>Payment</th><th>Reference</th><th>Receipt</th></tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.raw.id}>
                  <td className="mono">#{sale.id}</td>
                  <td>{dateLabel(sale.date)}</td>
                  <td>{sale.product}</td>
                  <td className="strong-cell">{peso(sale.commission)}</td>
                  <td><StatusPill status={sale.paymentStatus || 'unpaid'} /></td>
                  <td className="mono">{sale.paymentReference || '—'}</td>
                  <td>{sale.receiptPath ? <button className="text-btn" onClick={() => viewReceipt(sale)}><Eye size={15} /> View</button> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sales.length && <div className="empty">No confirmed commissions yet.</div>}
        </div>
      </div>
    </>
  );
}
