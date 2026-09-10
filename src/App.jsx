import React, { useEffect, useState } from 'react';
import { BadgeDollarSign, LayoutDashboard, Package, RefreshCw, ShoppingBag, UserRound, Users } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './supabase';
import { loadAdminData, loadAffiliateData, loadMyAccount, signOut } from './api';
import AddSaleModal from './components/admin/AddSaleModal';
import Loading from './components/common/Loading';
import Notice from './components/common/Notice';
import PortalLayout from './components/layout/PortalLayout';
import AdminAffiliates from './pages/admin/AdminAffiliates';
import AdminOrders from './pages/admin/AdminOrders';
import AdminOverview from './pages/admin/AdminOverview';
import AdminProducts from './pages/admin/AdminProducts';
import AffiliateCommissions from './pages/affiliate/AffiliateCommissions';
import AffiliateDashboard from './pages/affiliate/AffiliateDashboard';
import AffiliateSales from './pages/affiliate/AffiliateSales';
import PayoutProfile from './pages/affiliate/PayoutProfile';
import ConfigMissing from './pages/auth/ConfigMissing';
import Login from './pages/auth/Login';
import Onboarding from './pages/auth/Onboarding';
import ResetPassword from './pages/auth/ResetPassword';

function recoveryLinkIsOpen() {
  const hash = window.location.hash || '';
  const params = new URLSearchParams(window.location.search);
  return hash.includes('type=recovery') || params.get('type') === 'recovery';
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [account, setAccount] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState('');
  const [addSale, setAddSale] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(() => recoveryLinkIsOpen());

  async function refreshAccount() {
    setError('');
    const nextAccount = await loadMyAccount();
    setAccount(nextAccount);
    if (nextAccount.profile.role === 'admin') setData(await loadAdminData());
    else if (nextAccount.affiliate) setData(await loadAffiliateData(nextAccount.affiliate.id));
    else setData(null);
  }

  async function refreshData() {
    try {
      if (account?.profile.role === 'admin') setData(await loadAdminData());
      else if (account?.affiliate) setData(await loadAffiliateData(account.affiliate.id));
    } catch (err) { setError(err.message); }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let mounted = true;

    if (recoveryLinkIsOpen()) setPasswordRecovery(true);

    supabase.auth.getSession().then(({ data: authData }) => {
      if (mounted) setSession(authData.session || null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setSession(nextSession || null);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (passwordRecovery) return;
    if (session === undefined || !session) return;
    if (!account) refreshAccount().catch((err) => setError(err.message));
  }, [session, passwordRecovery]);

  useEffect(() => {
    if (!session) {
      setAccount(null);
      setData(null);
      setPage('dashboard');
    }
  }, [session]);

  if (!isSupabaseConfigured) return <ConfigMissing />;
  if (session === undefined) return <Loading />;
  if (passwordRecovery && session) return <ResetPassword onComplete={() => setPasswordRecovery(false)} />;
  if (!session) return <Login />;
  if (!account && !error) return <Loading />;

  if (error && !account) {
    return <div className="center-screen"><Notice type="error">{error}</Notice><button className="primary-btn" onClick={() => refreshAccount().catch((err) => setError(err.message))}><RefreshCw size={17} /> Retry</button></div>;
  }

  if (account.profile.role === 'affiliate' && !account.affiliate) return <Onboarding account={account} onComplete={refreshAccount} />;

  const isAdmin = account.profile.role === 'admin';
  const nav = isAdmin
    ? [
        ['dashboard', 'Overview', LayoutDashboard],
        ['affiliates', 'Athletes', Users],
        ['orders', 'Athlete Sales', ShoppingBag],
        ['products', 'Products', Package],
      ]
    : [
        ['dashboard', 'Dashboard', LayoutDashboard],
        ['sales', 'Sales', ShoppingBag],
        ['commissions', 'Commissions', BadgeDollarSign],
        ['payout', 'Profile', UserRound],
      ];

  let content;
  if (isAdmin) {
    if (!data) return <Loading />;
    if (page === 'affiliates') content = <AdminAffiliates data={data} />;
    else if (page === 'orders') content = <AdminOrders data={data} onRefresh={refreshData} onAddSale={() => setAddSale(true)} />;
    else if (page === 'products') content = <AdminProducts data={data} onRefresh={refreshData} />;
    else content = <AdminOverview data={data} onAddSale={() => setAddSale(true)} />;
  } else {
    if (!data) return <Loading />;
    if (page === 'sales') content = <AffiliateSales orders={data.orders} />;
    else if (page === 'commissions') content = <AffiliateCommissions orders={data.orders} />;
    else if (page === 'payout') content = <PayoutProfile account={account} onSaved={refreshAccount} />;
    else content = <AffiliateDashboard account={account} data={data} />;
  }

  async function logout() { await signOut(); }

  return (
    <PortalLayout account={account} isAdmin={isAdmin} page={page} setPage={setPage} nav={nav} collapsed={collapsed} setCollapsed={setCollapsed} error={error} onRefresh={refreshData} onLogout={logout}>
      {content}
      {addSale && <AddSaleModal affiliates={data.affiliates} products={data.products || []} onClose={() => setAddSale(false)} onSaved={refreshData} />}
    </PortalLayout>
  );
}
