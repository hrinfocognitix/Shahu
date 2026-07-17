import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { useAuth } from '../../hooks/useAuth';

export function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const submit = async event => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.patch('/users/me/password', form);
      setForm({ currentPassword: '', newPassword: '' });
      toast.success('Password updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card stack">
      <h2>Profile</h2>
      <p>{user?.name || 'No profile loaded'}</p>
      <p>{user?.email}</p>
      {user?.mustChangePassword && <p className="muted">Please update your initial password.</p>}
      <form className="student-form" onSubmit={submit}>
        <div className="student-fields">
          <label><span>Current password</span><input required type="password" value={form.currentPassword} onChange={event => update('currentPassword', event.target.value)} /></label>
          <label><span>New password</span><input required minLength={8} type="password" value={form.newPassword} onChange={event => update('newPassword', event.target.value)} /></label>
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Updating...' : 'Update password'}</button>
      </form>
    </section>
  );
}
