import React from 'react';
import { cn } from '../../utils/helpers';

export default function Modal({ children, onClose, className = '' }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className={cn('modal', className)}>{children}</div>
    </div>
  );
}
