import React from 'react';
import { Check, X } from 'lucide-react';
import { passwordRuleResults } from '../../utils/validation';

export default function PasswordChecklist({ password }) {
  const results = passwordRuleResults(password);
  return (
    <div className="password-checklist" aria-live="polite">
      <strong>Secure password requirements</strong>
      <div className="password-check-grid">
        {results.map((rule) => (
          <span key={rule.key} className={rule.passed ? 'passed' : ''}>
            {rule.passed ? <Check size={12} /> : <X size={12} />}
            {rule.label}
          </span>
        ))}
      </div>
      <small>Also avoid your email name and common passwords such as “password” or “123456”.</small>
    </div>
  );
}
