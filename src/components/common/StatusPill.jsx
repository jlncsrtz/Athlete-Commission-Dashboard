import React from 'react';
import { titleStatus } from '../../utils/helpers';

export default function StatusPill({ status }) {
  const key = String(status || '').toLowerCase();
  const className =
    key.includes('inactive')
      ? 'warn'
      : key.includes('paid') ||
    key.includes('confirmed') ||
    key.includes('approved') ||
    key.includes('active')
      ? 'good'
      : key.includes('refund') ||
          key.includes('reject') ||
          key.includes('cancel') ||
          key.includes('suspend')
        ? 'bad'
        : 'warn';

  return <span className={`pill ${className}`}>{titleStatus(status)}</span>;
}
