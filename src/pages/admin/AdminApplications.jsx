import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Image, RefreshCw, Search, UserRound, X } from 'lucide-react';
import { adminApproveAthleteApplication, adminSendAthleteApprovalEmail, signedImage } from '../../api';
import Modal from '../../components/common/Modal';
import Notice from '../../components/common/Notice';
import PageHeader from '../../components/common/PageHeader';
import StatusPill from '../../components/common/StatusPill';
import { affiliateProfile, payoutAccount } from '../../utils/helpers';

function athleteName(profile) {
  const splitName = [profile.first_name, profile.middle_name, profile.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return splitName || profile.full_name || 'Incomplete profile';
}

export default function AdminApplications({ data, onRefresh }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvedPopup, setApprovedPopup] = useState(null);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const [error, setError] = useState('');

  const applications = useMemo(() => {
    return (data.affiliates || [])
      .filter((athlete) => athlete.status === 'pending')
      .map((athlete) => ({
        ...athlete,
        profile: affiliateProfile(athlete),
        payout: payoutAccount(athlete),
      }))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [data.affiliates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter((athlete) => {
      const searchText = [
        athleteName(athlete.profile),
        athlete.profile.email,
        athlete.profile.mobile_number,
        athlete.profile.address,
        athlete.affiliate_code,
        athlete.payout?.payout_method,
        athlete.payout?.account_name,
        athlete.payout?.account_number,
        athlete.payout?.bank_name,
      ].join(' ').toLowerCase();
      return searchText.includes(q);
    });
  }, [applications, query]);

  useEffect(() => {
    let active = true;

    async function loadQr() {
      setQrUrl('');
      if (!selected?.payout?.qr_code_path) return;
      setQrLoading(true);
      try {
        const url = await signedImage('affiliate-qr', selected.payout.qr_code_path);
        if (active) setQrUrl(url || '');
      } finally {
        if (active) setQrLoading(false);
      }
    }

    loadQr();
    return () => { active = false; };
  }, [selected?.id, selected?.payout?.qr_code_path]);

  async function approveAthlete() {
    if (!selected) return;
    setApproving(true);
    setError('');

    try {
      const name = athleteName(selected.profile);
      const result = await adminApproveAthleteApplication(selected.id);
      await onRefresh?.();
      setSelected(null);
      setApprovedPopup({
        affiliateId: selected.id,
        name,
        emailSent: result.emailSent,
        emailError: result.emailError || null,
      });
    } catch (err) {
      setError(err.message || 'Unable to approve athlete application.');
    } finally {
      setApproving(false);
    }
  }

  async function retryApprovalEmail() {
    if (!approvedPopup?.affiliateId) return;
    setRetryingEmail(true);

    try {
      const result = await adminSendAthleteApprovalEmail(approvedPopup.affiliateId);
      setApprovedPopup((current) => current ? {
        ...current,
        emailSent: result.emailSent,
        emailError: result.emailError || null,
      } : current);
    } finally {
      setRetryingEmail(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="APPLICATIONS"
        title="Athlete applications"
        subtitle="Review the information submitted by new athletes before approving their accounts."
      />

      <div className="pending-approval-banner">
        <Clock3 size={20} />
        <div>
          <strong>{applications.length} pending application{applications.length === 1 ? '' : 's'}</strong>
          <span>Review the submitted profile and payout information before approving the account.</span>
        </div>
      </div>

      {error && <Notice type="error">{error}</Notice>}

      <div className="panel athlete-search-panel">
        <div className="filter-search athlete-account-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search applicant name, email, address, GCash / account number..."
          />
        </div>
        <span className="athlete-result-count">
          {filtered.length} application{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Athlete</th>
                <th>Code</th>
                <th>Mobile</th>
                <th>Payment method</th>
                <th>GCash / Account no.</th>
                <th>Status</th>
                <th>Application</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((athlete) => (
                <tr key={athlete.id} className="pending-athlete-row">
                  <td>
                    <strong>{athleteName(athlete.profile)}</strong>
                    <small className="subcell">{athlete.profile.email}</small>
                  </td>
                  <td className="mono">{athlete.affiliate_code || '—'}</td>
                  <td>{athlete.profile.mobile_number || '—'}</td>
                  <td>{athlete.payout?.payout_method || '—'}</td>
                  <td className="mono">{athlete.payout?.account_number || '—'}</td>
                  <td><StatusPill status={athlete.status} /></td>
                  <td>
                    <button
                      type="button"
                      className="secondary-btn tiny"
                      onClick={() => { setSelected(athlete); setError(''); }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">
              {applications.length ? 'No applications match your search.' : 'No athlete applications are waiting for approval.'}
            </div>
          )}
        </div>
      </div>

      {approvedPopup && (
        <Modal onClose={() => setApprovedPopup(null)} className="confirm-modal athlete-approved-modal">
          <div className="modal-head">
            <div>
              <span className="eyebrow">APPROVED ATHLETE</span>
              <h2>Athlete approved successfully</h2>
              <p><strong>{approvedPopup.name}</strong> can now sign in and access the athlete dashboard.</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setApprovedPopup(null)}>
              <X size={18} />
            </button>
          </div>

          <div className="pending-approval-banner" style={{ marginBottom: 0 }}>
            <CheckCircle2 size={20} />
            <div>
              <strong>Application approved</strong>
              <span>
                {approvedPopup.emailSent
                  ? 'An approval notification was sent to the athlete email.'
                  : 'The account is approved, but the approval email was not sent.'}
              </span>
              {!approvedPopup.emailSent && approvedPopup.emailError && (
                <small className="subcell" style={{ marginTop: 6 }}>
                  Email error: {approvedPopup.emailError}
                </small>
              )}
            </div>
          </div>

          <div className="modal-actions">
            {!approvedPopup.emailSent && (
              <button
                type="button"
                className="secondary-btn"
                onClick={retryApprovalEmail}
                disabled={retryingEmail}
              >
                {retryingEmail ? <RefreshCw className="spin" size={17} /> : <RefreshCw size={17} />}
                {retryingEmail ? 'Sending email...' : 'Retry approval email'}
              </button>
            )}
            <button type="button" className="primary-btn" onClick={() => setApprovedPopup(null)} disabled={retryingEmail}>
              <CheckCircle2 size={17} /> Done
            </button>
          </div>
        </Modal>
      )}

      {selected && (
        <Modal onClose={() => !approving && setSelected(null)} className="athlete-details-modal">
          <div className="modal-head">
            <div>
              <span className="eyebrow">ATHLETE APPLICATION</span>
              <h2>{athleteName(selected.profile)}</h2>
              <p>{selected.profile.email || ''}</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              disabled={approving}
              onClick={() => setSelected(null)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="athlete-detail-hero">
            <div className="athlete-detail-avatar"><UserRound size={25} /></div>
            <div>
              <strong>{athleteName(selected.profile)}</strong>
              <span>{selected.affiliate_code || 'No athlete code'} · <StatusPill status={selected.status} /></span>
            </div>
          </div>

          <div className="detail-grid athlete-detail-grid">
            <div><span>First name</span><strong>{selected.profile.first_name || '—'}</strong></div>
            <div><span>Middle name</span><strong>{selected.profile.middle_name || '—'}</strong></div>
            <div><span>Surname</span><strong>{selected.profile.last_name || '—'}</strong></div>
            <div><span>Email</span><strong>{selected.profile.email || '—'}</strong></div>
            <div><span>Mobile number</span><strong>{selected.profile.mobile_number || '—'}</strong></div>
            <div><span>Athlete code</span><strong className="mono">{selected.affiliate_code || '—'}</strong></div>
            <div className="athlete-detail-wide"><span>Address</span><strong>{selected.profile.address || '—'}</strong></div>
            <div><span>Payment method</span><strong>{selected.payout?.payout_method || '—'}</strong></div>
            <div><span>Account name</span><strong>{selected.payout?.account_name || '—'}</strong></div>
            <div><span>GCash / Account no.</span><strong className="mono">{selected.payout?.account_number || '—'}</strong></div>
            <div><span>Bank</span><strong>{selected.payout?.bank_name || '—'}</strong></div>
            <div><span>Application status</span><strong>{selected.status || 'pending'}</strong></div>
          </div>

          <div className="athlete-qr-review">
            <div className="sale-detail-section-title">
              <Image size={16} />
              <strong>Submitted payment QR</strong>
            </div>
            {qrLoading ? (
              <div className="athlete-qr-empty">
                <RefreshCw className="spin" size={22} /> Loading QR...
              </div>
            ) : qrUrl ? (
              <img src={qrUrl} alt={`${athleteName(selected.profile)} payment QR`} />
            ) : (
              <div className="athlete-qr-empty">No QR image available.</div>
            )}
          </div>

          <div className="athlete-review-actions">
            <button type="button" className="secondary-btn" onClick={() => setSelected(null)} disabled={approving}>
              Close
            </button>
            <button type="button" className="primary-btn" onClick={approveAthlete} disabled={approving}>
              {approving ? <RefreshCw className="spin" size={17} /> : <CheckCircle2 size={17} />}
              {approving ? 'Approving...' : 'Approve athlete'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
