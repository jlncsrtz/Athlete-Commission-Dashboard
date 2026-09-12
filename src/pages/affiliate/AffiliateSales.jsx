import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CircleDollarSign, Clock3, CreditCard, Download, Eye, Image, RefreshCw, Search, X } from 'lucide-react';
import { signedImage } from '../../api';
import Modal from '../../components/common/Modal';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusPill from '../../components/common/StatusPill';
import SalesTable from '../../components/sales/SalesTable';
import { dateLabel, exportSales, peso, salesFromOrders, titleStatus } from '../../utils/helpers';

function timestampLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function commissionLabel(status) {
  if (status === 'pending') return 'Pending commission';
  if (status === 'approved') return 'Approved commission';
  if (status === 'confirmed') return 'Confirmed commission';
  return 'Commission';
}

export default function AffiliateSales({ orders }) {
  const sales = salesFromOrders(orders);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedSale, setSelectedSale] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const commissionSummary = useMemo(() => sales.reduce((summary, sale) => {
    if (sale.status === 'pending') summary.pending += Number(sale.commission || 0);
    if (sale.status === 'approved') summary.approved += Number(sale.commission || 0);
    if (sale.status === 'confirmed') summary.confirmed += Number(sale.commission || 0);
    return summary;
  }, { pending: 0, approved: 0, confirmed: 0 }), [sales]);

  const filtered = sales.filter(
    (sale) =>
      (status === 'all' || sale.status === status) &&
      `${sale.id} ${sale.product} ${sale.category}`.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    let active = true;

    async function loadReceipt() {
      setReceiptUrl('');
      if (!selectedSale?.receiptPath) {
        setReceiptLoading(false);
        return;
      }

      setReceiptLoading(true);
      try {
        const url = await signedImage('payout-receipts', selectedSale.receiptPath);
        if (active) setReceiptUrl(url || '');
      } finally {
        if (active) setReceiptLoading(false);
      }
    }

    loadReceipt();
    return () => { active = false; };
  }, [selectedSale?.receiptPath]);

  return (
    <>
      <PageHeader
        eyebrow="SALES"
        title="Your attributed orders"
        subtitle="Order status moves through Pending → Approved → Confirmed. Cancelled orders are excluded."
      />

      <div className="stats-grid three commission-stage-stats">
        <StatCard icon={Clock3} label="Pending" value={peso(commissionSummary.pending)} detail="Potential commission awaiting admin approval" />
        <StatCard icon={BadgeCheck} label="Approved" value={peso(commissionSummary.approved)} detail="Approved commission waiting for confirmation" />
        <StatCard icon={CircleDollarSign} label="Confirmed" value={peso(commissionSummary.confirmed)} detail="Confirmed commission" accent />
      </div>

      <div className="toolbar panel">
        <div className="search">
          <Search size={17} />
          <input
            placeholder="Search order, product or category"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="secondary-btn" onClick={() => exportSales(filtered)}>
          <Download size={17} /> Export CSV
        </button>
      </div>
      <div className="panel">
        <SalesTable sales={filtered} onView={setSelectedSale} />
      </div>

      {selectedSale && (
        <Modal onClose={() => { setReceiptOpen(false); setSelectedSale(null); }} className="sale-details-modal">
          <div className="modal-head">
            <div>
              <span className="eyebrow">SALE DETAILS</span>
              <h2>Order #{selectedSale.id}</h2>
              <p>Complete sale and commission information.</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => { setReceiptOpen(false); setSelectedSale(null); }}>
              <X size={18} />
            </button>
          </div>

          <div className="sale-detail-status-row">
            <div>
              <span>Order status</span>
              <StatusPill status={selectedSale.status} />
            </div>
            <div>
              <span>Order date</span>
              <strong>{dateLabel(selectedSale.date)}</strong>
            </div>
          </div>

          <div className="sale-detail-section">
            <div className="sale-detail-section-title">
              <Eye size={16} />
              <strong>Sale information</strong>
            </div>
            <div className="sale-detail-grid">
              <div><span>Order number</span><strong className="mono">#{selectedSale.id}</strong></div>
              <div><span>Product</span><strong>{selectedSale.product}</strong></div>
              <div><span>Category</span><strong>{selectedSale.category || 'Uncategorized'}</strong></div>
              <div><span>Quantity</span><strong>{selectedSale.qty}</strong></div>
              <div><span>Total sale</span><strong>{peso(selectedSale.sale)}</strong></div>
              <div><span>{commissionLabel(selectedSale.status)}</span><strong className="sale-detail-accent">{peso(selectedSale.commission)}</strong></div>
            </div>
          </div>

          {selectedSale.status === 'approved' && (
            <div className="pending-approval-banner commission-stage-note">
              <Clock3 size={18} />
              <div>
                <strong>Approved commission</strong>
                <span>This can move to Confirmed starting the next calendar day after admin approval.</span>
              </div>
            </div>
          )}

          <div className="sale-detail-section">
            <div className="sale-detail-section-title">
              <CreditCard size={16} />
              <strong>Commission status details</strong>
            </div>
            <div className="sale-detail-grid">
              <div><span>Commission status</span><strong>{titleStatus(selectedSale.status)}</strong></div>
              <div><span>Payment method</span><strong>{selectedSale.paymentMethod || '—'}</strong></div>
              <div className="sale-detail-wide"><span>Reference number</span><strong className="mono sale-reference-value">{selectedSale.paymentReference || '—'}</strong></div>
              <div className="sale-detail-wide"><span>Payment recorded</span><strong>{timestampLabel(selectedSale.paidAt)}</strong></div>
            </div>
          </div>

          <div className="sale-detail-section">
            <div className="sale-detail-section-title">
              <Image size={16} />
              <strong>Payment receipt</strong>
            </div>
            <div className="sale-receipt-preview">
              {receiptLoading ? (
                <div className="sale-receipt-empty"><RefreshCw className="spin" size={24} /><span>Loading receipt...</span></div>
              ) : receiptUrl ? (
                <button type="button" className="sale-receipt-link receipt-preview-button" onClick={() => setReceiptOpen(true)}>
                  <img src={receiptUrl} alt={`Receipt for order ${selectedSale.id}`} />
                  <span>Click receipt to enlarge</span>
                </button>
              ) : (
                <div className="sale-receipt-empty"><Image size={24} /><span>No receipt uploaded for this sale.</span></div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {receiptOpen && receiptUrl && selectedSale && (
        <Modal onClose={() => setReceiptOpen(false)} className="receipt-popup-modal">
          <div className="modal-head">
            <div>
              <span className="eyebrow">PAYMENT RECEIPT</span>
              <h2>Order #{selectedSale.id}</h2>
              <p>Commission payment receipt</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setReceiptOpen(false)}><X size={18} /></button>
          </div>
          <div className="receipt-popup-image">
            <img src={receiptUrl} alt={`Full receipt for order ${selectedSale.id}`} />
          </div>
        </Modal>
      )}
    </>
  );
}
