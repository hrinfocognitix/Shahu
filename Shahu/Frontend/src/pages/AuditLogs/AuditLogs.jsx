import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FiActivity, FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { ROUTES } from '../../config/routes';

const displayDate = (value) => value ? new Date(value).toLocaleString('en-IN') : '—';

export function AuditLogs() {
  const user = useSelector((state) => state.auth.user);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'superadmin') return;
    const timer = setTimeout(() => {
      setLoading(true);
      apiClient.get('/audit-logs', { params: { page, limit: 25, search, module, from, to } })
        .then((response) => { setItems(response.data.data || []); setMeta(response.data.meta || {}); })
        .catch((error) => toast.error(error.response?.data?.message || 'Unable to load audit logs'))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [user?.role, page, search, module, from, to]);

  if (user?.role !== 'superadmin') return <Navigate to={ROUTES.dashboard} replace />;
  return <section className="audit-page page-enter">
    <div className="page-heading"><div><p className="eyebrow">SUPER ADMIN GOVERNANCE</p><h1>Audit logs</h1><p>Read-only history of important administrative and learning actions.</p></div><span className="student-total">{meta.total || 0} events</span></div>
    <div className="audit-filters">
      <label><FiSearch /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search action, module, role or reason" /></label>
      <input type="text" value={module} onChange={(event) => { setModule(event.target.value); setPage(1); }} placeholder="Module" />
      <input type="date" aria-label="From date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
      <input type="date" aria-label="To date" min={from} value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
    </div>
    {loading ? <div className="card student-empty">Loading audit history…</div> : items.length ? <div className="audit-list">{items.map((item) => <article className="card" key={item._id}>
      <span className="audit-icon"><FiActivity /></span><div><h3>{item.action.replaceAll('_', ' ')}</h3><p>{item.module} · {item.role || 'system'} · {item.user?.name || item.user?.email || 'System process'}</p><small>{displayDate(item.createdAt)}{item.reason ? ` · ${item.reason}` : ''}</small></div>
      <button type="button" onClick={() => setExpanded(expanded === item._id ? '' : item._id)}>{expanded === item._id ? 'Hide' : 'Details'}</button>
      {expanded === item._id && <pre>{JSON.stringify({ recordId: item.recordId, previousValue: item.previousValue, newValue: item.newValue, ipAddress: item.ipAddress }, null, 2)}</pre>}
    </article>)}</div> : <div className="card student-empty">No audit events match these filters.</div>}
    <div className="student-pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><FiChevronLeft /> Previous</button><span>{page} / {meta.totalPages || 1}</span><button disabled={page >= (meta.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next <FiChevronRight /></button></div>
  </section>;
}
