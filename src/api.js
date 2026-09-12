import { requireSupabase } from './supabase';
import { passwordErrors, validateProfileForm } from './utils/validation';

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
  const securePasswordErrors = passwordErrors(password, email);
  if (securePasswordErrors.length) throw new Error(securePasswordErrors.join(' • '));
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
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
  const securePasswordErrors = passwordErrors(password);
  if (securePasswordErrors.length) throw new Error(securePasswordErrors.join(' • '));
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function loadMyAccount() {
  const client = requireSupabase();
  const user = await getSessionUser();
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, role, full_name, first_name, middle_name, last_name, address, email, mobile_number')
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
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) throw new Error('QR upload must be a PNG, JPG/JPEG, or WEBP image.');
  if (file.size <= 0) throw new Error('The selected QR image is empty.');
  if (file.size > 5 * 1024 * 1024) throw new Error('QR image must be 5 MB or smaller.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) throw new Error('QR image has an unsupported file extension.');
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

async function edgeFunctionErrorMessage(error) {
  let message = error?.message || 'Email notification failed.';

  try {
    const response = error?.context;
    if (response && typeof response.clone === 'function') {
      const payload = await response.clone().json();
      message = payload?.error || payload?.message || message;
    }
  } catch {
    // Keep the original Supabase Functions error message when the response body is not JSON.
  }

  return message;
}

async function notifyAthleteApplication(event, affiliateId) {
  const client = requireSupabase();

  try {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      return { emailSent: false, emailError: 'No active login session for the email notification.' };
    }

    const { data, error } = await client.functions.invoke('athlete-application-email', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { event, affiliate_id: affiliateId },
    });

    if (error) {
      return { emailSent: false, emailError: await edgeFunctionErrorMessage(error) };
    }

    if (data?.success === false || data?.email_sent === false) {
      return {
        emailSent: false,
        emailError: data?.error || data?.message || 'The Edge Function did not send the email.',
      };
    }

    return { emailSent: true, emailError: null };
  } catch (error) {
    console.warn('Athlete application email notification failed:', error);
    return {
      emailSent: false,
      emailError: error?.message || 'Email notification failed.',
    };
  }
}

export async function completeOnboarding(values, qrCodePath) {
  const client = requireSupabase();
  const formErrors = validateProfileForm(values, { includeAffiliateCode: true });
  if (formErrors.length) throw new Error(formErrors.join(' • '));
  if (!qrCodePath) throw new Error('A valid payout QR image is required.');
  const { data, error } = await client.rpc('complete_affiliate_onboarding', {
    p_first_name: values.firstName.trim(),
    p_middle_name: values.middleName?.trim() || null,
    p_last_name: values.lastName.trim(),
    p_address: values.address.trim(),
    p_mobile_number: values.mobile.trim(),
    p_affiliate_code: values.affiliateCode.trim().toUpperCase(),
    p_payout_method: values.payoutMethod,
    p_account_name: values.accountName.trim(),
    p_account_number: values.accountNumber.trim(),
    p_bank_name: values.bankName?.trim() || null,
    p_qr_code_path: qrCodePath,
  });
  if (error) throw error;
  await notifyAthleteApplication('submitted', data);
  return data;
}

export async function updateMyPayoutProfile(values, qrCodePath) {
  const client = requireSupabase();
  const formErrors = validateProfileForm(values);
  if (formErrors.length) throw new Error(formErrors.join(' • '));
  const { data, error } = await client.rpc('update_my_payout_profile', {
    p_first_name: values.firstName.trim(),
    p_middle_name: values.middleName?.trim() || null,
    p_last_name: values.lastName.trim(),
    p_address: values.address.trim(),
    p_mobile_number: values.mobile.trim(),
    p_payout_method: values.payoutMethod,
    p_account_name: values.accountName.trim(),
    p_account_number: values.accountNumber.trim(),
    p_bank_name: values.bankName?.trim() || null,
    p_qr_code_path: qrCodePath || null,
  });
  if (error) throw error;
  await notifyAthleteApplication('submitted', data);
  return data;
}

export async function loadAffiliateData(affiliateId) {
  const client = requireSupabase();
  const [{ data: orders, error: ordersError }] = await Promise.all([
    client
      .from('orders')
      .select('id, external_order_number, order_date, final_sale, status, commission_approved_at, order_items(product_name_snapshot, product_category_snapshot, commission_per_unit_snapshot, quantity, line_total), commissions(commission_rate, commission_amount, payment_status, payment_method, reference_number, receipt_path, paid_at, payout_id)')
      .eq('affiliate_id', affiliateId)
      .order('order_date', { ascending: false }),
  ]);
  if (ordersError) throw ordersError;
  return { orders: orders || [] };
}

export async function loadAdminData() {
  const client = requireSupabase();
  const [affiliatesResult, ordersResult, commissionsResult, productsResult] = await Promise.all([
    client.from('affiliates').select('id,user_id,affiliate_code,commission_rate,status,approved_at,created_at,profiles(full_name,first_name,middle_name,last_name,address,email,mobile_number),payout_accounts(payout_method,account_name,account_number,bank_name,qr_code_path,verified_at)').order('created_at', { ascending: false }),
    client.from('orders').select('id,external_order_number,affiliate_id,order_date,final_sale,status,commission_approved_at,order_items(product_name_snapshot,product_category_snapshot,commission_per_unit_snapshot,quantity,line_total),commissions(commission_rate,commission_amount,payment_status,payment_method,reference_number,receipt_path,paid_at,payout_id)').order('order_date', { ascending: false }).limit(500),
    client.from('commissions').select('id,affiliate_id,order_id,commission_rate,qualified_sale,commission_amount,payment_status,payment_method,reference_number,receipt_path,paid_at,payout_id,created_at').limit(1000),
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


export async function adminApproveAthleteApplication(affiliateId) {
  // Approval and the approval email are handled by one authenticated Edge Function call.
  // If email delivery fails, the Edge Function rolls the athlete back to pending so
  // the admin never sees an approved athlete who was not notified.
  const result = await notifyAthleteApplication('approved', affiliateId);
  if (!result.emailSent) {
    throw new Error(result.emailError || 'The athlete could not be approved because the approval email was not sent.');
  }
  return result;
}

export async function adminSendAthleteApprovalEmail(affiliateId) {
  return notifyAthleteApplication('approved', affiliateId);
}

function saleItemsPayload(items = []) {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: Number(item.quantity),
  }));
}

export async function adminCreateSale(values) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_create_sale_multi', {
    p_affiliate_id: values.affiliateId,
    p_external_order_number: values.orderNumber.trim(),
    p_order_date: values.orderDate,
    p_items: saleItemsPayload(values.items),
  });
  if (error) throw error;
  return data;
}

export async function adminCreateHistoricalConfirmedSale(values) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_create_historical_confirmed_sale_multi', {
    p_affiliate_id: values.affiliateId,
    p_external_order_number: values.orderNumber.trim(),
    p_order_date: values.orderDate,
    p_items: saleItemsPayload(values.items),
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

export async function adminApproveOrderWithPayment(orderId, values, receiptPath) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_approve_order_with_payment', {
    p_order_id: orderId,
    p_payment_method: values.method,
    p_reference_number: values.ref?.trim() || null,
    p_receipt_path: receiptPath,
  });
  if (error) throw error;
  return data;
}

export async function uploadBatchPayoutReceipt(athleteUserId, file) {
  const client = requireSupabase();
  if (!file) throw new Error('Payment receipt is required.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Receipt image must be 8 MB or smaller.');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Receipt must be a JPG, PNG, or WEBP image.');
  }
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${athleteUserId}/batch-${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await client.storage.from('payout-receipts').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function adminPaySelectedCommissions(affiliateId, orderIds, values, receiptPath) {
  const client = requireSupabase();
  if (!Array.isArray(orderIds) || !orderIds.length) throw new Error('Select at least one commission to pay.');
  const { data, error } = await client.rpc('admin_pay_selected_commissions', {
    p_affiliate_id: affiliateId,
    p_order_ids: orderIds,
    p_payment_method: values.method,
    p_reference_number: values.ref?.trim() || null,
    p_receipt_path: receiptPath,
    p_admin_note: null,
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
