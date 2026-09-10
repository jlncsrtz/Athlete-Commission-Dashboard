import React, { useState } from 'react';
import { Download, Search } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SalesTable from '../../components/sales/SalesTable';
import { exportSales, salesFromOrders } from '../../utils/helpers';

export default function AffiliateSales({ orders }) {
  const sales = salesFromOrders(orders);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = sales.filter(
    (sale) =>
      (status === 'all' || sale.status === status) &&
      `${sale.id} ${sale.product} ${sale.category}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        eyebrow="SALES"
        title="Your attributed orders"
        subtitle="Every order connected to your athlete account appears here."
      />
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
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="secondary-btn" onClick={() => exportSales(filtered)}>
          <Download size={17} /> Export CSV
        </button>
      </div>
      <div className="panel">
        <SalesTable sales={filtered} />
      </div>
    </>
  );
}
