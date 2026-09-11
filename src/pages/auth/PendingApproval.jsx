import React, { useState } from 'react';
import { Clock3, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import BrandMark from '../../components/common/BrandMark';

export default function PendingApproval({ account, onRefresh, onLogout }) {
  const [busy, setBusy] = useState(false);
  const suspended = account?.affiliate?.status === 'suspended';

  async function refresh() {
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell approval-shell">
      <div className="auth-brand approval-brand">
        <BrandMark />
        <div>
          <strong>PEAKATHLETE</strong>
          <span>Athlete's Commission Portal</span>
        </div>
      </div>

      <div className="auth-card approval-card">
        <div className="approval-icon">
          {suspended ? <ShieldCheck size={30} /> : <Clock3 size={30} />}
        </div>
        <span className="eyebrow">ACCOUNT REVIEW</span>
        <h1>{suspended ? 'Your athlete account needs admin review.' : 'Your application is pending approval.'}</h1>
        <p>
          {suspended
            ? 'Your account is currently suspended. Please contact the PEAKATHLETE admin for assistance.'
            : 'Your profile and payout information were submitted successfully. An admin will review your details before your dashboard is activated.'}
        </p>

        {!suspended && (
          <div className="approval-note">
            <ShieldCheck size={18} />
            <div>
              <strong>What happens next?</strong>
              <span>Once an admin approves your application, we will send an approval notice to {account.profile.email || account.user.email}.</span>
            </div>
          </div>
        )}

        <div className="approval-actions">
          <button type="button" className="primary-btn" onClick={refresh} disabled={busy}>
            <RefreshCw className={busy ? 'spin' : ''} size={17} />
            {busy ? 'Checking...' : 'Check approval status'}
          </button>
          <button type="button" className="secondary-btn" onClick={onLogout}>
            <LogOut size={17} /> Log out
          </button>
        </div>
      </div>
    </div>
  );
}
