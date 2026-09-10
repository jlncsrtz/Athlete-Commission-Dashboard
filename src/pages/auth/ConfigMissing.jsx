import React from 'react';
import BrandMark from '../../components/common/BrandMark';

export default function ConfigMissing() {
  return (
    <div className="auth-shell">
      <div className="auth-card setup-card">
        <BrandMark />
        <span className="eyebrow">SUPABASE SETUP REQUIRED</span>
        <h1>Connect the new project.</h1>
        <p>
          This build is using real Supabase data. Create a <code>.env</code> file in the
          project root and add the values from your Athlete's Supabase project.
        </p>
        <pre>
          VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co{`\n`}
          VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
        </pre>
        <p>
          Then run <code>supabase-schema.sql</code> in that Supabase project's SQL Editor
          and restart <code>npm run dev</code>.
        </p>
      </div>
    </div>
  );
}
