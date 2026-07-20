import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FiEdit2, FiPlus, FiSearch, FiShield, FiX } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { ROUTES } from '../../config/routes';

export function Users() {
  const user = useSelector((state) => state.auth.user);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1, total: 0 });
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [credential, setCredential] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (user?.role !== 'superadmin') return;
    setLoading(true);
    apiClient.get('/admins', { params: { page, limit: 20, search } })
      .then((response) => { setItems(response.data.data || []); setMeta(response.data.meta || {}); })
      .catch((error) => toast.error(error.response?.data?.message || 'Unable to load admins'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { const timer = setTimeout(load, 200); return () => clearTimeout(timer); }, [user?.role, page, search]);

  if (user?.role !== 'superadmin') return <Navigate to={ROUTES.dashboard} replace />;
  const save = async (event) => {
    event.preventDefault();
    try {
      if (editing) {
        await apiClient.patch(`/admins/${editing._id}`, { name: form.name, isActive: form.isActive });
        toast.success('Admin updated');
      } else {
        const response = await apiClient.post('/admins', { name: form.name, email: form.email });
        setCredential(response.data.data);
        toast.success('Admin created');
      }
      setForm(null); setEditing(null); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to save admin'); }
  };
  return <section className="admin-management page-enter">
    <div className="page-heading"><div><p className="eyebrow">SUPER ADMIN</p><h1>Admin management</h1><p>Create and manage portal administrators. Email remains immutable after creation.</p></div><button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', email: '', isActive: true }); }}><FiPlus /> Add admin</button></div>
    <label className="teacher-search"><FiSearch /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search admin name or email" /></label>
    {loading ? <div className="card student-empty">Loading admins…</div> : <div className="admin-grid">{items.map((item) => <article className="card" key={item._id}>
      <span className="admin-shield"><FiShield /></span><div><h3>{item.name}</h3><p>{item.email}</p><small>Created {new Date(item.createdAt).toLocaleDateString('en-IN')} · Last login {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString('en-IN') : 'Never'}</small></div><span className={`status-pill ${item.isActive ? 'active' : 'cancelled'}`}>{item.isActive ? 'Active' : 'Inactive'}</span><button className="text-button" onClick={() => { setEditing(item); setForm({ name: item.name, email: item.email, isActive: item.isActive }); }}><FiEdit2 /> Edit</button>
    </article>)}</div>}
    <div className="student-pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>{page} / {meta.totalPages || 1}</span><button disabled={page >= (meta.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div>
    {form && <div className="login-overlay"><form className="student-form" onSubmit={save}><button type="button" className="modal-close" onClick={() => setForm(null)}><FiX /></button><h2>{editing ? 'Update admin' : 'Add admin'}</h2><div className="student-fields"><label><span>Full name</span><input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label><label><span>Email {editing && '(read-only)'}</span><input required type="email" readOnly={Boolean(editing)} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>{editing && <label><span>Status</span><select value={String(form.isActive)} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === 'true' }))}><option value="true">Active</option><option value="false">Inactive</option></select></label>}</div><button className="btn btn-primary modal-submit">{editing ? 'Save changes' : 'Create admin'}</button></form></div>}
    {credential && <div className="login-overlay"><article className="student-detail-panel credential-panel"><button className="modal-close" onClick={() => setCredential(null)}><FiX /></button><h2>One-time admin credentials</h2><p>Copy this password now. It is not stored or shown again, and the Admin must replace it after login.</p><dl><div><dt>Email</dt><dd>{credential.admin.email}</dd></div><div><dt>Temporary password</dt><dd>{credential.temporaryPassword}</dd></div></dl></article></div>}
  </section>;
}
