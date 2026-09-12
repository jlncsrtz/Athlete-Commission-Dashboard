import React from 'react';
import { cn } from '../../utils/helpers';

export default function StatCard({ icon: Icon, label, value, detail = null, accent = false }) {
  return (
    <div className={cn('stat-card', accent && 'accent-card')}>
      <div className="stat-icon">
        <Icon size={20} />
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  );
}
