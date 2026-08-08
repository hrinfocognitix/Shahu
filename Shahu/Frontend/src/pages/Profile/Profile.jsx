import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { useAuth } from '../../hooks/useAuth';
import { useDispatch } from 'react-redux';
import { FiAtSign, FiCheckCircle, FiLock, FiSave, FiShield, FiUser } from 'react-icons/fi';
import { passwordChanged, profileUpdated } from '../../redux/slices/authSlice';

export function Profile() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const [name, setName] = useState(user?.name || '');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) return toast.error('Enter a name with at least 2 characters.');
    setSavingProfile(true);
    try {
      const response = await apiClient.patch('/users/me', { name: trimmedName, profile: {} });
      dispatch(profileUpdated(response.data.data));
      toast.success('Profile information saved');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save profile information');
    } finally {
      setSavingProfile(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword.length < 8) return toast.error('New password must contain at least 8 characters.');
    if (form.newPassword !== confirmPassword) return toast.error('New passwords do not match.');
    setSubmitting(true);
    try {
      await apiClient.patch('/users/me/password', form);
      dispatch(passwordChanged());
      setForm({ currentPassword: '', newPassword: '' });
      setConfirmPassword('');
      toast.success('Password updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="admin-profile page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACCOUNT SETTINGS</p>
          <h1>My profile</h1>
          <p>Manage your administrator account and keep it secure.</p>
        </div>
      </div>

      {user?.mustChangePassword && <div className="admin-profile-alert"><FiShield /><div><strong>Password update required</strong><span>Your account uses a temporary password. Set a new one before continuing.</span></div></div>}

      <div className="admin-profile-grid">
        <aside className="card admin-profile-summary">
          <span className="admin-profile-avatar">{(user?.name || 'A').charAt(0).toUpperCase()}</span>
          <h2>{user?.name || 'Administrator'}</h2>
          <p>{user?.email || 'No email available'}</p>
          <span className="admin-profile-role"><FiShield /> {user?.role === 'superadmin' ? 'Super administrator' : 'Administrator'}</span>
          <div className="admin-profile-status"><FiCheckCircle /><span>Account active</span></div>
        </aside>

        <div className="admin-profile-forms">
          <form className="card admin-profile-form" onSubmit={saveProfile}>
            <div className="card-heading"><div><p className="section-kicker">PERSONAL INFORMATION</p><h2>Account details</h2></div><FiUser /></div>
            <div className="admin-profile-fields">
              <label><span>Full name</span><input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label><span>Email address</span><div className="admin-profile-readonly"><FiAtSign />{user?.email || '—'}</div><small>Email addresses are managed by the super administrator.</small></label>
            </div>
            <button className="btn btn-primary" disabled={savingProfile} type="submit"><FiSave /> {savingProfile ? 'Saving…' : 'Save changes'}</button>
          </form>

          <form className="card admin-profile-form" onSubmit={submit}>
            <div className="card-heading"><div><p className="section-kicker">SECURITY</p><h2>Change password</h2></div><FiLock /></div>
            <p className="admin-profile-copy">Use a unique password with at least 8 characters.</p>
            <div className="admin-profile-fields admin-password-fields">
              <label><span>Current password</span><input required autoComplete="current-password" type="password" value={form.currentPassword} onChange={(event) => update('currentPassword', event.target.value)} /></label>
              <label><span>New password</span><input required minLength={8} autoComplete="new-password" type="password" value={form.newPassword} onChange={(event) => update('newPassword', event.target.value)} /></label>
              <label><span>Confirm new password</span><input required minLength={8} autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}><FiLock /> {submitting ? 'Updating…' : 'Update password'}</button>
          </form>
        </div>
      </div>
    </section>
  );
}
