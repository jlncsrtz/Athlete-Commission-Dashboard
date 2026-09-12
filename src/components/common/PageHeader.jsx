import React from 'react';

export default function PageHeader({ eyebrow, title, subtitle, action = null }) {
  return (
    <div className="page-header action-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
