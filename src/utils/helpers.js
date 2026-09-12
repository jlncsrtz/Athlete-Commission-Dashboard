export function peso(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function dateLabel(value) {
  if (!value) return '—';
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }).format(d);
}

export function cn(...parts) { return parts.filter(Boolean).join(' '); }
export function relationOne(value) { return Array.isArray(value) ? value[0] || null : value || null; }
export function orderCommission(order) { return relationOne(order?.commissions); }
export function orderItems(order) { return Array.isArray(order?.order_items) ? order.order_items : order?.order_items ? [order.order_items] : []; }
export function affiliateProfile(affiliate) { return relationOne(affiliate?.profiles) || { full_name: 'Unknown athlete', first_name: '', middle_name: '', last_name: '', address: '', email: '', mobile_number: '' }; }
export function payoutAccount(affiliate) { return relationOne(affiliate?.payout_accounts); }
export function titleStatus(status) { return String(status || '').replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
export function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
export function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export function estimatedCommissionFromOrder(order) {
  return orderItems(order).reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.commission_per_unit_snapshot || 0)),
    0,
  );
}

export function canConfirmApprovedSale(sale, now = new Date()) {
  if (String(sale?.status || '').toLowerCase() !== 'approved') return false;
  if (!sale?.commissionApprovedAt) return false;

  const approved = new Date(sale.commissionApprovedAt);
  if (Number.isNaN(approved.getTime())) return false;

  const phDate = (date) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);

  return phDate(now) > phDate(approved);
}

export function salesFromOrders(orders) {
  return (orders || []).map((order) => {
    const items = orderItems(order);
    const commissionRecord = orderCommission(order);
    const estimatedCommission = estimatedCommissionFromOrder(order);
    const actualCommission = Number(commissionRecord?.commission_amount || 0);
    const status = String(order.status || '').toLowerCase();
    const displayCommission = status === 'confirmed'
      ? (actualCommission || estimatedCommission)
      : estimatedCommission;
    const categories = [...new Set(items.map((item) => item.product_category_snapshot).filter(Boolean))];

    return {
      id: order.external_order_number,
      date: order.order_date,
      product: items.map((item) => item.product_name_snapshot).join(', ') || 'Order',
      category: categories.join(', ') || '',
      qty: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      sale: Number(order.final_sale || 0),
      commission: displayCommission,
      rate: Number(commissionRecord?.commission_rate || 0),
      paymentStatus: commissionRecord?.payment_status || 'unpaid',
      paymentMethod: commissionRecord?.payment_method || '',
      paymentReference: commissionRecord?.reference_number || '',
      receiptPath: commissionRecord?.receipt_path || '',
      paidAt: commissionRecord?.paid_at || null,
      commissionApprovedAt: order.commission_approved_at || null,
      status,
      raw: order,
    };
  });
}

export function exportSales(sales) {
  const rows = [
    ['Order', 'Date', 'Product', 'Category', 'Qty', 'Sale', 'Commission', 'Status'],
    ...sales.map((sale) => [sale.id, sale.date, sale.product, sale.category || '', sale.qty, sale.sale, sale.commission, sale.status]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  anchor.download = 'athlete-sales.csv';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}
