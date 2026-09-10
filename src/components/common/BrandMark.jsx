import React from 'react';
import { cn } from '../../utils/helpers';

export default function BrandMark({ className = '' }) {
  return (
    <img
      className={cn('brand-logo-img', className)}
      src="peakathlete-logo.png"
      alt="Peakathlete"
    />
  );
}
