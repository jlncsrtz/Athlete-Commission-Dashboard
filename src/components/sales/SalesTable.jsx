import React from 'react';
import { Eye } from 'lucide-react';
import StatusPill from '../common/StatusPill';
import { canConfirmApprovedSale, dateLabel, peso } from '../../utils/helpers';

function optionDisabled(sale, option) {
  const current = sale.status;
  if (current === option) return false;
  if (current === 'pending') return !['approved', 'cancelled'].includes(option);
  if (current === 'approved') {
    if (option === 'confirmed') return !canConfirmApprovedSale(sale);
    return option !== 'cancelled';
  }
  return true;
}

export default function SalesTable({ sales, admin = false, onStatus = null, onView = null }) {
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
            {onView && <th>Action</th>}
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
                {admin ? (
                  <select
                    className="status-select"
                    value={sale.status}
                    onChange={(event) => onStatus?.(sale.raw.id, event.target.value)}
                  >
                    <option value="pending" disabled={optionDisabled(sale, 'pending')}>Pending</option>
                    <option value="approved" disabled={optionDisabled(sale, 'approved')}>Approved</option>
                    <option value="confirmed" disabled={optionDisabled(sale, 'confirmed')}>Confirmed</option>
                    <option value="cancelled" disabled={optionDisabled(sale, 'cancelled')}>Cancelled</option>
                  </select>
                ) : (
                  <StatusPill status={sale.status} />
                )}
              </td>
              {onView && (
                <td>
                  <button
                    type="button"
                    className="secondary-btn sale-view-btn"
                    onClick={() => onView(sale)}
                  >
                    <Eye size={15} /> View
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!sales.length && <div className="empty">No sales found.</div>}
    </div>
  );
}
