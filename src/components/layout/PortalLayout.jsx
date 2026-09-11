import React from 'react';
import {
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import BrandMark from '../common/BrandMark';
import Notice from '../common/Notice';

export default function PortalLayout({
  account,
  isAdmin,
  page,
  setPage,
  nav,
  collapsed,
  setCollapsed,
  error,
  onRefresh,
  onLogout,
  children,
}) {
  const initials = isAdmin
    ? 'AD'
    : (account.profile.full_name || 'AF')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

  const activeNav = nav.find(([id]) => id === page);
  const activeLabel = activeNav?.[1] || (isAdmin ? 'Overview' : 'Dashboard');

  return (
    <div className="app-shell">
      <aside className={`${collapsed ? 'sidebar collapsed' : 'sidebar'} ${isAdmin ? 'admin-sidebar' : 'athlete-sidebar'}`}>
        <div className="side-top">
          <div className="side-brand">
            <BrandMark />
            {!collapsed && (
              <div>
                <strong>PEAKATHLETE</strong>
                <span>{isAdmin ? 'Admin Portal' : "Athlete's Portal"}</span>
              </div>
            )}
          </div>
          <button
            className="icon-btn collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? 'nav-item active' : 'nav-item'}
              onClick={() => setPage(id)}
              title={label}
            >
              <Icon size={19} />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        <div className="side-bottom">
          {!collapsed && (
            <div className="mini-profile">
              <div className="avatar">{initials}</div>
              <div>
                <strong>{isAdmin ? 'Admin' : account.profile.full_name}</strong>
                <span>{isAdmin ? 'Administrator' : account.affiliate.affiliate_code}</span>
              </div>
            </div>
          )}
          <button className="nav-item" onClick={onLogout}>
            <LogOut size={19} />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div className="mobile-title">{activeLabel}</div>
          <div className="topbar-right">
            <span className="system-dot" />
            <span className="system-label">Supabase connected</span>
            <button className="icon-btn" onClick={onRefresh} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <div className="top-role">
              <ShieldCheck size={15} />
              {isAdmin ? 'Admin' : 'Athlete'}
            </div>
            <button className="mobile-logout-btn" onClick={onLogout} title="Log out" aria-label="Log out">
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </header>

        <div className="content">
          {error && <Notice type="error">{error}</Notice>}
          {children}
        </div>
      </main>
    </div>
  );
}
