import { requireSupabase } from './supabase';

export async function getSessionUser() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function signIn(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

export async function updateMyPassword(password) {
  const client = requireSupabase();
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function loadMyAccount() {
  const client = requireSupabase();
  const user = await getSessionUser();
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, role, full_name, email, mobile_number')
    .eq('id', user.id)
    .single();
  if (profileError) throw profileError;

  if (profile.role === 'admin') {
    return { user, profile, affiliate: null, payoutAccount: null };
  }

  const { data: affiliate, error: affiliateError } = await client
    .from('affiliates')
    .select('id, user_id, affiliate_code, commission_rate, status, approved_at, created_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (affiliateError) throw affiliateError;

  let payoutAccount = null;
  if (affiliate) {
    const { data, error } = await client
      .from('payout_accounts')
      .select('id, affiliate_id, payout_method, account_name, account_number, bank_name, qr_code_path, verified_at')
      .eq('affiliate_id', affiliate.id)
      .maybeSingle();
    if (error) throw error;
    payoutAccount = data;
  }

  return { user, profile, affiliate, payoutAccount };
}

export async function uploadMyQr(userId, file) {
  const client = requireSupabase();
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error('QR image must be 5 MB or smaller.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${userId}/qr-${Date.now()}.${ext || 'jpg'}`;
  const { error } = await client.storage.from('affiliate-qr').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function signedImage(bucket, path, expiresIn = 900) {
  if (!path) return null;
  const client = requireSupabase();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function completeOnboarding(values, qrCodePath) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('complete_affiliate_onboarding', {
    p_full_name: values.fullName.trim(),
    p_mobile_number: values.mobile.trim(),
    p_affiliate_code: values.affiliateCode.trim().toUpperCase(),
    p_payout_method: values.payoutMethod,
    p_account_name: values.accountName.trim(),
    p_account_number: values.accountNumber.trim(),
    p_bank_name: values.bankName?.trim() || null,
    p_qr_code_path: qrCodePath,
  });
  if (error) throw error;
  return data;
}

export async function updateMyPayoutProfile(values, qrCodePath) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_my_payout_profile', {
    p_full_name: values.fullName.trim(),
    p_mobile_number: values.mobile.trim(),
    p_payout_method: values.payoutMethod,
    p_account_name: values.accountName.trim(),
    p_account_number: values.accountNumber.trim(),
    p_bank_name: values.bankName?.trim() || null,
    p_qr_code_path: qrCodePath || null,
  });
  if (error) throw error;
  return data;
}

export async function loadAffiliateData(affiliateId) {
  const client = requireSupabase();
  const [{ data: orders, error: ordersError }] = await Promise.all([
    client
      .from('orders')
      .select('id, external_order_number, order_date, final_sale, status, order_items(product_name_snapshot, product_category_snapshot, commission_per_unit_snapshot, quantity, line_total), commissions(commission_rate, commission_amount, payment_status, payment_method, reference_number, receipt_path, paid_at)')
      .eq('affiliate_id', affiliateId)
      .order('order_date', { ascending: false }),
  ]);
  if (ordersError) throw ordersError;
  return { orders: orders || [] };
}

export async function loadAdminData() {
  const client = requireSupabase();
  const [affiliatesResult, ordersResult, commissionsResult, productsResult] = await Promise.all([
    client.from('affiliates').select('id,user_id,affiliate_code,commission_rate,status,approved_at,created_at,profiles(full_name,email,mobile_number),payout_accounts(payout_method,account_name,account_number,bank_name,qr_code_path,verified_at)').order('created_at', { ascending: false }),
    client.from('orders').select('id,external_order_number,affiliate_id,order_date,final_sale,status,order_items(product_name_snapshot,product_category_snapshot,commission_per_unit_snapshot,quantity,line_total),commissions(commission_rate,commission_amount,payment_status,payment_method,reference_number,receipt_path,paid_at)').order('order_date', { ascending: false }).limit(500),
    client.from('commissions').select('id,affiliate_id,order_id,commission_rate,qualified_sale,commission_amount,payment_status,payment_method,reference_number,receipt_path,paid_at,created_at').limit(1000),
    client.from('products').select('id,sku,name,category,selling_price,commission_price,active,created_at,updated_at').order('name'),
  ]);
  for (const result of [affiliatesResult, ordersResult, commissionsResult, productsResult]) {
    if (result.error) throw result.error;
  }
  return {
    affiliates: affiliatesResult.data || [],
    orders: ordersResult.data || [],
    commissions: commissionsResult.data || [],
    products: productsResult.data || [],
  };
}

export async function adminCreateSale(values) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_create_sale', {
    p_affiliate_id: values.affiliateId,
    p_external_order_number: values.orderNumber.trim(),
    p_order_date: values.orderDate,
    p_product_id: values.productId,
    p_quantity: Number(values.quantity),
    p_status: values.status,
  });
  if (error) throw error;
  return data;
}

export async function adminSaveProduct(values) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_save_product', {
    p_product_id: values.id || null,
    p_name: values.name.trim(),
    p_sku: values.sku?.trim() || null,
    p_category: values.category.trim(),
    p_selling_price: Number(values.sellingPrice),
    p_commission_price: Number(values.commissionPrice),
    p_active: values.active !== false,
  });
  if (error) throw error;
  return data;
}

export async function adminDeleteProduct(productId) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_delete_product', { p_product_id: productId });
  if (error) throw error;
  return data;
}

export async function uploadCommissionReceipt(athleteUserId, orderId, file) {
  const client = requireSupabase();
  if (!file) return null;
  if (file.size > 8 * 1024 * 1024) throw new Error('Receipt image must be 8 MB or smaller.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${athleteUserId}/direct-${orderId}-${Date.now()}.${ext || 'jpg'}`;
  const { error } = await client.storage.from('payout-receipts').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function adminMarkCommissionPaid(orderId, values, receiptPath = null) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_mark_commission_paid', {
    p_order_id: orderId,
    p_payment_method: values.method,
    p_reference_number: values.ref.trim(),
    p_receipt_path: receiptPath,
  });
  if (error) throw error;
  return data;
}

export async function adminUpdateOrderStatus(orderId, status) {
  const client = requireSupabase();
  const { error } = await client.rpc('admin_update_order_status', {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
}
