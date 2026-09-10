import React from 'react';

export default function Notice({ type = 'info', children }) {
  return <div className={`notice ${type}`}>{children}</div>;
}
