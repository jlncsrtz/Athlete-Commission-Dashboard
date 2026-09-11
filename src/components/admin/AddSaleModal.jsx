import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Eye,
  ImagePlus,
  Package,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import {
  adminCreateSale,
  adminMarkCommissionPaid,
  signedImage,
  uploadCommissionReceipt,
} from '../../api';
import Field from '../common/Field';
import Modal from '../common/Modal';
import Notice from '../common/Notice';
import { affiliateProfile, payoutAccount, peso, today } from '../../utils/helpers';

function includesText(value, query) {
  return String(value || '').toLowerCase().includes(String(query || '').trim().toLowerCase());
}

export default function AddSaleModal({ affiliates, products = [], onClose, onSaved }) {
  const [form, setForm] = useState({
    affiliateId: '',
    athleteSearch: '',
    athleteCodeSearch: '',
    orderNumber: '',
    orderDate: today(),
    productId: '',
    productName: '',
    productCategory: '',
    quantity: 1,
    unitPrice: '',
    commissionPrice: '',
    status: 'confirmed',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [athleteOpen, setAthleteOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [qrPopup, setQrPopup] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [payment, setPayment] = useState({ method: 'GCash', ref: '', receipt: null });

  const activeProducts = useMemo(
    () => products.filter((product) => product.active !== false),
    [products],
  );

  const selectedAthlete = useMemo(
    () => affiliates.find((athlete) => athlete.id === form.affiliateId) || null,
    [affiliates, form.affiliateId],
  );

  const selectedPayout = useMemo(
    () => (selectedAthlete ? payoutAccount(selectedAthlete) : null),
    [selectedAthlete],
  );

  const nameSuggestions = useMemo(() => {
    const q = form.athleteSearch.trim().toLowerCase();
    return affiliates
      .filter((athlete) => {
        const profile = affiliateProfile(athlete);
        return !q || `${profile.full_name} ${athlete.affiliate_code} ${profile.email}`.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [affiliates, form.athleteSearch]);

  const codeSuggestions = useMemo(() => {
    const q = form.athleteCodeSearch.trim().toLowerCase();
    return affiliates
      .filter((athlete) => {
        const profile = affiliateProfile(athlete);
        return !q || `${athlete.affiliate_code} ${profile.full_name}`.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [affiliates, form.athleteCodeSearch]);

  const productSuggestions = useMemo(() => {
    const q = form.productName.trim();
    return activeProducts
      .filter((product) => !q || includesText(`${product.name} ${product.sku || ''} ${product.category || ''}`, q))
      .slice(0, 8);
  }, [activeProducts, form.productName]);

  const quantity = Math.max(0, Number(form.quantity || 0));
  const estimatedSale = quantity * Number(form.unitPrice || 0);
  const estimatedCommission = quantity * Number(form.commissionPrice || 0);
  const directPaymentEnabled = form.status === 'confirmed';

  useEffect(() => {
    let active = true;

    async function loadQr() {
      setQrUrl('');
      if (!selectedPayout?.qr_code_path) {
        setQrLoading(false);
        return;
      }
      setQrLoading(true);
      try {
        const url = await signedImage('affiliate-qr', selectedPayout.qr_code_path);
        if (active) setQrUrl(url || '');
      } finally {
        if (active) setQrLoading(false);
      }
    }

    loadQr();
    return () => { active = false; };
  }, [selectedPayout?.qr_code_path]);

  function pickAthlete(athlete) {
    const profile = affiliateProfile(athlete);
    const payout = payoutAccount(athlete);
    setForm((current) => ({
      ...current,
      affiliateId: athlete.id,
      athleteSearch: profile.full_name || '',
      athleteCodeSearch: athlete.affiliate_code || '',
    }));
    setPayment((current) => ({ ...current, method: payout?.payout_method || 'GCash' }));
    setAthleteOpen(false);
    setCodeOpen(false);
    setQrPopup(false);
  }

  function handleAthleteNameChange(value) {
    const exact = affiliates.find((athlete) => {
      const profile = affiliateProfile(athlete);
      return profile.full_name?.toLowerCase() === value.trim().toLowerCase();
    });
    if (exact) {
      pickAthlete(exact);
      return;
    }
    setForm((current) => ({ ...current, athleteSearch: value, athleteCodeSearch: '', affiliateId: '' }));
    setAthleteOpen(true);
  }

  function handleAthleteCodeChange(value) {
    const normalized = value.toUpperCase().replace(/\s/g, '');
    const exact = affiliates.find(
      (athlete) => String(athlete.affiliate_code || '').toUpperCase() === normalized,
    );
    if (exact) {
      pickAthlete(exact);
      return;
    }
    setForm((current) => ({ ...current, athleteCodeSearch: normalized, athleteSearch: '', affiliateId: '' }));
    setCodeOpen(true);
  }

  function pickProduct(product) {
    setForm((current) => ({
      ...current,
      productId: product.id,
      productName: product.name,
      productCategory: product.category || 'Uncategorized',
      unitPrice: Number(product.selling_price || 0),
      commissionPrice: Number(product.commission_price || 0),
    }));
    setProductOpen(false);
  }

  function viewQr() {
    if (!selectedPayout?.qr_code_path) return;
    setQrPopup(true);
  }

  async function copyAccountNumber() {
    if (!selectedPayout?.account_number) return;
    await navigator.clipboard?.writeText(selectedPayout.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!form.affiliateId) throw new Error('Select an athlete from the suggestions.');
      if (!form.productId) throw new Error('Select a product from the suggestions.');
      if (directPaymentEnabled && !payment.receipt) {
        throw new Error('Upload a receipt image before saving a confirmed sale.');
      }
      const orderId = await adminCreateSale(form);

      if (directPaymentEnabled) {
        let receiptPath = null;
        if (payment.receipt) {
          receiptPath = await uploadCommissionReceipt(selectedAthlete.user_id, orderId, payment.receipt);
        }
        await adminMarkCommissionPaid(orderId, payment, receiptPath);
      }

      onClose();
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal onClose={onClose} className="modal-xxlarge add-sale-modal">
        <form onSubmit={submit} className="modal-form">
          <div className="modal-head">
            <div>
              <span className="eyebrow">MANUAL ENSTACK ENTRY</span>
              <h2>Add athlete sale</h2>
              <p>Search by athlete name or code. Confirmed commissions are recorded as paid directly by default.</p>
            </div>
            <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>

          {error && <Notice type="error">{error}</Notice>}

          <div className="add-sale-layout compact-payment-layout">
            <div className="add-sale-main">
              <div className="field-grid two add-sale-grid">
                <Field label="Athlete name">
                  <div className="autocomplete">
                    <Search size={16} className="autocomplete-icon" />
                    <input
                      required
                      value={form.athleteSearch}
                      onFocus={() => setAthleteOpen(true)}
                      onChange={(event) => handleAthleteNameChange(event.target.value)}
                      onBlur={() => setTimeout(() => setAthleteOpen(false), 150)}
                      placeholder="Type athlete name"
                      autoComplete="off"
                    />
                    <ChevronDown size={15} className="autocomplete-chevron" />
                    {athleteOpen && (
                      <div className="autocomplete-menu">
                        {nameSuggestions.map((athlete) => {
                          const profile = affiliateProfile(athlete);
                          return (
                            <button type="button" key={athlete.id} onMouseDown={() => pickAthlete(athlete)}>
                              <strong>{profile.full_name || 'Unnamed athlete'}</strong>
                              <span>{athlete.affiliate_code}</span>
                            </button>
                          );
                        })}
                        {!nameSuggestions.length && <div className="autocomplete-empty">No matching athlete.</div>}
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Athlete's code">
                  <div className="autocomplete">
                    <Search size={16} className="autocomplete-icon" />
                    <input
                      required
                      value={form.athleteCodeSearch}
                      onFocus={() => setCodeOpen(true)}
                      onChange={(event) => handleAthleteCodeChange(event.target.value)}
                      onBlur={() => setTimeout(() => setCodeOpen(false), 150)}
                      placeholder="Type athlete code"
                      autoComplete="off"
                    />
                    <ChevronDown size={15} className="autocomplete-chevron" />
                    {codeOpen && (
                      <div className="autocomplete-menu">
                        {codeSuggestions.map((athlete) => {
                          const profile = affiliateProfile(athlete);
                          return (
                            <button type="button" key={athlete.id} onMouseDown={() => pickAthlete(athlete)}>
                              <strong>{athlete.affiliate_code}</strong>
                              <span>{profile.full_name || 'Unnamed athlete'}</span>
                            </button>
                          );
                        })}
                        {!codeSuggestions.length && <div className="autocomplete-empty">No matching athlete code.</div>}
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Enstack / order number">
                  <input required value={form.orderNumber} onChange={(event) => setForm({ ...form, orderNumber: event.target.value })} placeholder="e.g. PA-2510" />
                </Field>

                <Field label="Order date">
                  <input type="date" required value={form.orderDate} onChange={(event) => setForm({ ...form, orderDate: event.target.value })} />
                </Field>

                <Field label="Product">
                  <div className="autocomplete">
                    <Search size={16} className="autocomplete-icon" />
                    <input
                      required
                      value={form.productName}
                      onFocus={() => setProductOpen(true)}
                      onChange={(event) => {
                        setForm({
                          ...form,
                          productId: '',
                          productName: event.target.value,
                          productCategory: '',
                          unitPrice: '',
                          commissionPrice: '',
                        });
                        setProductOpen(true);
                      }}
                      onBlur={() => setTimeout(() => setProductOpen(false), 150)}
                      placeholder="Type product name"
                      autoComplete="off"
                    />
                    <ChevronDown size={15} className="autocomplete-chevron" />
                    {productOpen && (
                      <div className="autocomplete-menu product-suggestion-menu">
                        {productSuggestions.map((product) => (
                          <button type="button" key={product.id} onMouseDown={() => pickProduct(product)}>
                            <div className="suggestion-row">
                              <div>
                                <strong>{product.name}</strong>
                                <span>{product.category || 'Uncategorized'}{product.sku ? ` • ${product.sku}` : ''}</span>
                              </div>
                              <div className="suggestion-prices">
                                <b>{peso(product.selling_price)}</b>
                                <small>{peso(product.commission_price)} commission</small>
                              </div>
                            </div>
                          </button>
                        ))}
                        {!productSuggestions.length && (
                          <div className="autocomplete-empty">No matching product. Add it first from Products.</div>
                        )}
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Quantity">
                  <input type="number" min="1" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
                </Field>

                <Field label="Category">
                  <input readOnly value={form.productCategory} placeholder="Auto-filled" />
                </Field>

                <Field label="Order status">
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
              </div>

              <div className="sale-auto-values">
                <div><span>Product price</span><strong>{peso(form.unitPrice)}</strong></div>
                <div><span>Commission / item</span><strong>{peso(form.commissionPrice)}</strong></div>
                <div><span>Sale total</span><strong>{peso(estimatedSale)}</strong></div>
                <div className="commission-total-card"><span>Athlete commission</span><strong>{peso(estimatedCommission)}</strong></div>
              </div>

              <div className={directPaymentEnabled ? 'direct-payment-box direct-payment-default' : 'direct-payment-box direct-payment-disabled'}>
                <div className="direct-payment-title-row">
                  <div>
                    <strong>Direct commission payment</strong>
                    <span>{directPaymentEnabled ? 'This confirmed commission will be saved as paid automatically.' : 'Pending or cancelled sales do not create a payable commission.'}</span>
                  </div>
                  <span className="direct-default-pill">DEFAULT</span>
                </div>

                {directPaymentEnabled && (
                  <div className="field-grid three direct-payment-fields">
                    <Field label="Payment method">
                      <select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}>
                        <option>GCash</option><option>Maya</option><option>BDO</option><option>BPI</option><option>UnionBank</option><option>Metrobank</option><option>Other Bank</option>
                      </select>
                    </Field>
                    <Field label="Reference number (optional)">
                      <input value={payment.ref} onChange={(event) => setPayment({ ...payment, ref: event.target.value })} placeholder="Payment reference (optional)" />
                    </Field>
                    <Field label="Receipt image (required)">
                      <label className="file-inline-btn">
                        <ImagePlus size={15} /> {payment.receipt ? payment.receipt.name : 'Choose image'}
                        <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPayment({ ...payment, receipt: event.target.files?.[0] || null })} />
                      </label>
                    </Field>
                  </div>
                )}
              </div>

              <button className="primary-btn full add-sale-submit" disabled={busy}>
                {busy ? <RefreshCw className="spin" size={17} /> : <Package size={17} />}
                Save athlete sale
              </button>
            </div>

            <aside className="athlete-payout-preview compact-payout-preview">
              <div className="payout-preview-title">
                <CreditCard size={18} />
                <div>
                  <span className="eyebrow">DIRECT PAYMENT DETAILS</span>
                  <strong>{selectedAthlete ? affiliateProfile(selectedAthlete).full_name : 'Select an athlete'}</strong>
                </div>
              </div>

              {!selectedAthlete ? (
                <div className="payout-preview-empty">Choose an athlete by name or code to show their GCash / bank details and QR code.</div>
              ) : (
                <>
                  <div className="qr-preview-box inline-athlete-qr">
                    {qrLoading ? (
                      <RefreshCw className="spin" size={28} />
                    ) : qrUrl ? (
                      <img src={qrUrl} alt="Athlete payment QR" />
                    ) : (
                      <div className="qr-placeholder"><CreditCard size={24} /><span>No QR uploaded</span></div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="secondary-btn full view-qr-popup-btn"
                    disabled={!selectedPayout?.qr_code_path || !qrUrl}
                    onClick={viewQr}
                  >
                    <Eye size={16} /> {selectedPayout?.qr_code_path ? 'View QR code' : 'No QR uploaded'}
                  </button>

                  <div className="payout-preview-details compact-details">
                    <div><span>Method</span><strong>{selectedPayout?.payout_method || '—'}</strong></div>
                    <div><span>Account name</span><strong>{selectedPayout?.account_name || '—'}</strong></div>
                    <div className="account-number-row">
                      <span>GCash / account number</span>
                      <strong className="mono">{selectedPayout?.account_number || '—'}</strong>
                      {selectedPayout?.account_number && (
                        <button type="button" className="copy-number-btn" onClick={copyAccountNumber}>
                          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <div><span>Bank</span><strong>{selectedPayout?.bank_name || '—'}</strong></div>
                    <div><span>Athlete code</span><strong className="mono">{selectedAthlete.affiliate_code}</strong></div>
                  </div>
                </>
              )}
            </aside>
          </div>
        </form>
      </Modal>

      {qrPopup && (
        <Modal onClose={() => setQrPopup(false)} className="qr-popup-modal">
          <div className="modal-head">
            <div>
              <span className="eyebrow">PAYMENT QR</span>
              <h2>{selectedAthlete ? affiliateProfile(selectedAthlete).full_name : 'Athlete'}</h2>
              <p>{selectedPayout?.account_number || ''}</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setQrPopup(false)}><X size={18} /></button>
          </div>
          <div className="qr-popup-image">
            {qrLoading ? <RefreshCw className="spin" size={28} /> : qrUrl ? <img src={qrUrl} alt="Athlete payment QR" /> : <span>QR image could not be loaded.</span>}
          </div>
        </Modal>
      )}
    </>
  );
}
