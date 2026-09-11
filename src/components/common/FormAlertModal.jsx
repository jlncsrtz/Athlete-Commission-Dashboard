import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Modal from './Modal';

export default function FormAlertModal({ open, title = 'Please check your information', errors = [], onClose }) {
  if (!open) return null;
  const items = Array.isArray(errors) ? errors.filter(Boolean) : [errors].filter(Boolean);

  return (
    <Modal onClose={onClose} className="form-alert-modal">
      <div className="modal-head form-alert-head">
        <div className="form-alert-title">
          <span className="form-alert-icon"><AlertTriangle size={20} /></span>
          <div>
            <span className="eyebrow">ACTION NEEDED</span>
            <h2>{title}</h2>
            <p>Fix the item{items.length === 1 ? '' : 's'} below, then try again.</p>
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close error popup">
          <X size={18} />
        </button>
      </div>

      <div className="form-alert-list">
        {items.map((item, index) => (
          <div className="form-alert-item" key={`${item}-${index}`}>
            <span>{index + 1}</span>
            <p>{item}</p>
          </div>
        ))}
      </div>

      <button type="button" className="primary-btn full" onClick={onClose}>Okay, I’ll fix it</button>
    </Modal>
  );
}
