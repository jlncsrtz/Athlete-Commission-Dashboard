import React from 'react';
import StatusPill from '../common/StatusPill';
import { dateLabel, peso } from '../../utils/helpers';

export default function SalesTable({ sales, admin = false, onStatus }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Date</th>
            <th>Product</th>
            <th>Category</th>
            <th>Qty</th>
            <th>Sale</th>
            <th>Commission</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.raw?.id || sale.id}>
              <td className="mono">#{sale.id}</td>
              <td>{dateLabel(sale.date)}</td>
              <td>{sale.product}</td>
              <td>{sale.category || 'Uncategorized'}</td>
              <td>{sale.qty}</td>
              <td>{peso(sale.sale)}</td>
              <td className="strong-cell">{peso(sale.commission)}</td>
              <td>
                {admin && sale.status !== 'refunded' ? (
                  <select
                    className="status-select"
                    value={sale.status}
                    onChange={(event) => onStatus?.(sale.raw.id, event.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                ) : (
                  <StatusPill status={sale.status} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sales.length && <div className="empty">No sales found.</div>}
    </div>
  );
}
