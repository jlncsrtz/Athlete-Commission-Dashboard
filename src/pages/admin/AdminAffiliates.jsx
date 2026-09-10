import React, { useMemo, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import Modal from '../../components/common/Modal';
import PageHeader from '../../components/common/PageHeader';
import { affiliateProfile, orderItems, payoutAccount, peso } from '../../utils/helpers';

export default function AdminAffiliates({ data }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const summaries = useMemo(
    () => data.affiliates.map((athlete) => {
      const profile = affiliateProfile(athlete);
      const payout = payoutAccount(athlete);
      const orders = data.orders.filter(
        (order) => order.affiliate_id === athlete.id && order.status === 'confirmed',
      );
      const commissions = data.commissions.filter(
        (commission) => commission.affiliate_id === athlete.id,
      );
      const paid = commissions
        .filter((commission) => commission.payment_status === 'paid')
        .reduce((sum, commission) => sum + Number(commission.commission_amount || 0), 0);

      return {
        ...athlete,
        profile,
        payout,
        sales: orders.reduce((sum, order) => sum + Number(order.final_sale || 0), 0),
        products: orders.reduce(
          (sum, order) => sum + orderItems(order).reduce((qty, item) => qty + Number(item.quantity || 0), 0),
          0,
        ),
        commission: commissions.reduce((sum, commission) => sum + Number(commission.commission_amount || 0), 0),
        paid,
      };
    }),
    [data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((athlete) => {
      const searchText = [
        athlete.profile.full_name,
        athlete.profile.email,
        athlete.profile.mobile_number,
        athlete.affiliate_code,
        athlete.payout?.payout_method,
        athlete.payout?.account_name,
        athlete.payout?.account_number,
      ].join(' ').toLowerCase();
      return searchText.includes(q);
    });
  }, [summaries, query]);

  return (
    <>
      <PageHeader
        eyebrow="ATHLETES"
        title="Athlete accounts"
        subtitle="Search athletes and view their sales, product totals, commissions, and saved payment information."
      />

      <div className="panel athlete-search-panel">
        <div className="filter-search athlete-account-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search athlete name, code, email, GCash / account number..."
          />
        </div>
        <span className="athlete-result-count">{filtered.length} athlete{filtered.length === 1 ? '' : 's'}</span>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Athlete</th>
                <th>Code</th>
                <th>Sales</th>
                <th>Products</th>
                <th>Commission</th>
                <th>Paid</th>
                <th>Payment method</th>
                <th>GCash / Account no.</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((athlete) => (
                <tr key={athlete.id}>
                  <td>
                    <strong>{athlete.profile.full_name || 'Incomplete profile'}</strong>
                    <small className="subcell">{athlete.profile.email}</small>
                  </td>
                  <td className="mono">{athlete.affiliate_code}</td>
                  <td>{peso(athlete.sales)}</td>
                  <td>{athlete.products}</td>
                  <td className="strong-cell">{peso(athlete.commission)}</td>
                  <td>{peso(athlete.paid)}</td>
                  <td>{athlete.payout?.payout_method || '—'}</td>
                  <td className="mono">{athlete.payout?.account_number || '—'}</td>
                  <td><button className="secondary-btn tiny" onClick={() => setSelected(athlete)}>View details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div className="empty">No athletes match your search.</div>}
        </div>
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)} className="athlete-details-modal">
          <div className="modal-head">
            <div>
              <span className="eyebrow">ATHLETE DETAILS</span>
              <h2>{selected.profile.full_name || 'Athlete'}</h2>
              <p>{selected.profile.email || ''}</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setSelected(null)}><X size={18} /></button>
          </div>

          <div className="athlete-detail-hero">
            <div className="athlete-detail-avatar"><UserRound size={25} /></div>
            <div>
              <strong>{selected.profile.full_name || 'Incomplete profile'}</strong>
              <span>{selected.affiliate_code}</span>
            </div>
          </div>

          <div className="detail-grid athlete-detail-grid">
            <div><span>Email</span><strong>{selected.profile.email || '—'}</strong></div>
            <div><span>Mobile number</span><strong>{selected.profile.mobile_number || '—'}</strong></div>
            <div><span>Athlete code</span><strong className="mono">{selected.affiliate_code || '—'}</strong></div>
            <div><span>Sales</span><strong>{peso(selected.sales)}</strong></div>
            <div><span>Products sold</span><strong>{selected.products}</strong></div>
            <div><span>Commission</span><strong>{peso(selected.commission)}</strong></div>
            <div><span>Paid</span><strong>{peso(selected.paid)}</strong></div>
            <div><span>Payment method</span><strong>{selected.payout?.payout_method || '—'}</strong></div>
            <div><span>Account name</span><strong>{selected.payout?.account_name || '—'}</strong></div>
            <div><span>GCash / Account no.</span><strong className="mono">{selected.payout?.account_number || '—'}</strong></div>
            <div className="athlete-detail-wide"><span>Bank</span><strong>{selected.payout?.bank_name || '—'}</strong></div>
          </div>
        </Modal>
      )}
    </>
  );
}
