import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function Loading() {
  return (
    <div className="center-screen">
      <RefreshCw className="spin" size={30} />
      <strong>Loading athlete's portal…</strong>
    </div>
  );
}
