import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { ROUTES } from '../../config/routes';

export function MobileApiCapacity() {
  const user = useSelector((state) => state.auth.user);
  const [control, setControl] = useState({ id: '', maxActiveUsers: 200, delaySeconds: 10 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== 'superadmin') return;
    apiClient.get('/settings', { params: { limit: 100 } }).then((response) => {
      const record = (response.data.data || []).find((item) => item.title === 'Mobile API load control');
      if (record) setControl({ id: record._id, maxActiveUsers: Number(record.payload?.maxActiveUsers || 200), delaySeconds: Number(record.payload?.delaySeconds || 10) });
    }).catch(() => toast.error('Unable to load mobile API settings.'));
  }, [user?.role]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      title: 'Mobile API load control',
      description: 'Superadmin mobile API capacity control',
      status: 'active',
      payload: { maxActiveUsers: Math.max(1, Number(control.maxActiveUsers || 1)), delaySeconds: Number(control.delaySeconds) },
    };
    try {
      if (control.id) await apiClient.patch(`/settings/${control.id}`, payload);
      else {
        const response = await apiClient.post('/settings', payload);
        setControl((current) => ({ ...current, id: response.data.data?._id || '' }));
      }
      toast.success('Mobile API capacity saved.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save mobile API capacity.');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'superadmin') return <Navigate replace to={ROUTES.dashboard} />;

  return <section className="page-enter settings-page stack">
    <div className="page-heading"><div><p className="eyebrow">SUPER ADMIN ONLY</p><h1>Mobile API Capacity</h1><p>Control when Android API responses should slow down during high usage.</p></div></div>
    <form className="card stack" onSubmit={save}>
      <div><p className="eyebrow">ACTIVE-USER RESPONSE DELAY</p><h2>Capacity control</h2><p className="muted">When active Android users exceed the selected limit, authenticated mobile API requests wait for the selected delay. Set delay to Off to disable this behaviour.</p></div>
      <div className="student-fields"><label className="field"><span>Maximum active users</span><input min="1" required type="number" value={control.maxActiveUsers} onChange={(event) => setControl((current) => ({ ...current, maxActiveUsers: event.target.value }))} /></label><label className="field"><span>Response delay</span><select value={control.delaySeconds} onChange={(event) => setControl((current) => ({ ...current, delaySeconds: event.target.value }))}><option value="0">Off</option><option value="10">10 seconds</option><option value="20">20 seconds</option></select></label></div>
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save mobile API control'}</button>
    </form>
  </section>;
}
