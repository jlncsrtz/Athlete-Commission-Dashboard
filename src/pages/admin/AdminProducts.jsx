import React, { useMemo, useState } from 'react';
import { Edit3, Package, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { adminDeleteProduct, adminSaveProduct } from '../../api';
import Field from '../../components/common/Field';
import Modal from '../../components/common/Modal';
import Notice from '../../components/common/Notice';
import PageHeader from '../../components/common/PageHeader';
import StatusPill from '../../components/common/StatusPill';
import { peso } from '../../utils/helpers';

const blankProduct = {
  id: null,
  name: '',
  sku: '',
  category: '',
  sellingPrice: '',
  commissionPrice: '',
  active: true,
};

export default function AdminProducts({ data, onRefresh }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('active');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const categories = useMemo(
    () => [...new Set((data.products || []).map((product) => product.category).filter(Boolean))].sort(),
    [data.products],
  );

  const filtered = useMemo(() => (data.products || []).filter((product) => {
    const text = `${product.name} ${product.sku || ''} ${product.category || ''}`.toLowerCase();
    const matchesQuery = !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesCategory = category === 'all' || product.category === category;
    const matchesStatus = status === 'all' || (status === 'active' ? product.active : !product.active);
    return matchesQuery && matchesCategory && matchesStatus;
  }), [data.products, query, category, status]);

  function openNew() {
    setError('');
    setMessage('');
    setEditing({ ...blankProduct });
  }

  function openEdit(product) {
    setError('');
    setMessage('');
    setEditing({
      id: product.id,
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      sellingPrice: Number(product.selling_price || 0),
      commissionPrice: Number(product.commission_price || 0),
      active: product.active !== false,
    });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (Number(editing.commissionPrice) > Number(editing.sellingPrice)) {
        throw new Error('Commission price cannot be higher than the product price.');
      }
      await adminSaveProduct(editing);
      setEditing(null);
      await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct() {
    if (!deleting) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await adminDeleteProduct(deleting.id);
      setDeleting(null);
      setMessage(result === 'archived'
        ? 'This product already has sales history, so it was archived instead of permanently deleted.'
        : 'Product deleted.');
      await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="PRODUCTS"
        title="Product commission catalog"
        subtitle="Set each product's category, selling price, and fixed athlete commission per item."
        action={<button className="primary-btn" onClick={openNew}><Plus size={17} /> Add product</button>}
      />

      {error && !editing && !deleting && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}

      <div className="panel product-filter-panel">
        <div className="product-filter-grid">
          <div className="search">
            <Search size={16} />
            <input placeholder="Search product, SKU, or category" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="active">Active products</option>
            <option value="inactive">Inactive products</option>
            <option value="all">All products</option>
          </select>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Category</th><th>SKU</th><th>Price</th><th>Commission / item</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td className="strong-cell"><div className="product-name-cell"><Package size={15} /> {product.name}</div></td>
                  <td>{product.category || 'Uncategorized'}</td>
                  <td className="mono">{product.sku || '—'}</td>
                  <td>{peso(product.selling_price)}</td>
                  <td className="product-commission-cell">{peso(product.commission_price)}</td>
                  <td><StatusPill status={product.active ? 'active' : 'inactive'} /></td>
                  <td>
                    <div className="row-actions">
                      <button className="secondary-btn tiny" onClick={() => openEdit(product)}><Edit3 size={14} /> Edit</button>
                      <button className="danger-btn tiny" onClick={() => { setError(''); setMessage(''); setDeleting(product); }}><Trash2 size={14} /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div className="empty">No products match your filters.</div>}
        </div>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} className="product-modal">
          <form onSubmit={save} className="modal-form">
            <div className="modal-head">
              <div>
                <span className="eyebrow">{editing.id ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</span>
                <h2>{editing.id ? editing.name : 'Add product'}</h2>
                <p>This price and commission will auto-fill when you select the product in Add Sale.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>

            {error && <Notice type="error">{error}</Notice>}

            <div className="field-grid two">
              <Field label="Product name">
                <input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
              </Field>
              <Field label="SKU (optional)">
                <input value={editing.sku} onChange={(event) => setEditing({ ...editing, sku: event.target.value })} placeholder="e.g. PA-COMP-BLK" />
              </Field>
              <Field label="Category">
                <input required list="product-page-categories" value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })} placeholder="e.g. Compression Tops" />
                <datalist id="product-page-categories">
                  {categories.map((item) => <option key={item} value={item} />)}
                </datalist>
              </Field>
              <Field label="Product price">
                <input type="number" min="0" step="0.01" required value={editing.sellingPrice} onChange={(event) => setEditing({ ...editing, sellingPrice: event.target.value })} />
              </Field>
              <Field label="Commission per item">
                <input type="number" min="0" step="0.01" required value={editing.commissionPrice} onChange={(event) => setEditing({ ...editing, commissionPrice: event.target.value })} />
              </Field>
              <Field label="Product status">
                <select value={editing.active ? 'active' : 'inactive'} onChange={(event) => setEditing({ ...editing, active: event.target.value === 'active' })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </div>

            <div className="product-commission-preview">
              <span>Athlete earns</span>
              <strong>{peso(editing.commissionPrice)}</strong>
              <small>for every 1 item sold at {peso(editing.sellingPrice)}</small>
            </div>

            <button className="primary-btn full" disabled={busy}>
              {busy ? <RefreshCw className="spin" size={17} /> : <Package size={17} />} Save product
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)} className="confirm-modal">
          <div className="modal-head">
            <div>
              <span className="eyebrow">DELETE PRODUCT</span>
              <h2>{deleting.name}</h2>
              <p>If it has no sales history it will be deleted permanently. If it has past sales, it will be archived so historical records stay correct.</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setDeleting(null)}><X size={18} /></button>
          </div>
          {error && <Notice type="error">{error}</Notice>}
          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={() => setDeleting(null)}>Cancel</button>
            <button type="button" className="danger-btn" disabled={busy} onClick={removeProduct}>
              {busy ? <RefreshCw className="spin" size={16} /> : <Trash2 size={16} />} Delete product
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
