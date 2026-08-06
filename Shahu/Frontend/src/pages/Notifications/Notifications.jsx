import { useEffect, useState } from 'react';
import { FiBell, FiSend, FiTrash2 } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { Card } from '../../components/Card/Card';

const emptyForm = { title: '', description: '', student: '' };

export function Notifications() {
  const user = useSelector((state) => state.auth.user);
  const [students, setStudents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const [studentResponse, notificationResponse] = await Promise.all([
        apiClient.get('/students', { params: { limit: 500, status: 'active' } }),
        apiClient.get('/notifications', { params: { limit: 50 } }),
      ]);
      setStudents(studentResponse.data.data || []);
      setNotifications(notificationResponse.data.data || []);
      setSelectedIds([]);
    } catch {
      toast.error('Unable to load notifications.');
    }
  };
  useEffect(() => { void load(); }, []);

  const send = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) { toast.error('Notification title is required.'); return; }
    setSending(true);
    try {
      await apiClient.post('/notifications', {
        title: form.title.trim(),
        description: form.description.trim(),
        audience: form.student ? 'student' : 'all',
        student: form.student || undefined,
        status: 'active',
      });
      toast.success(form.student ? 'Notification sent to the selected student.' : 'Notification sent to all devices.');
      setForm(emptyForm);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Unable to send notification.');
    } finally { setSending(false); }
  };

  const toggleSelection = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectAll = () => setSelectedIds(selectedIds.length === notifications.length ? [] : notifications.map((item) => item._id));
  const removeSelected = async () => {
    if (!selectedIds.length || !window.confirm(`Permanently delete ${selectedIds.length} notification${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => apiClient.delete(`/notifications/${id}/permanent`)));
      toast.success(`${selectedIds.length} notification${selectedIds.length === 1 ? '' : 's'} permanently deleted.`);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to permanently delete selected notifications.');
    } finally { setDeleting(false); }
  };

  return <section className="management-page">
    <div className="page-heading"><div><p className="eyebrow">PUSH NOTIFICATIONS</p><h1>Send notification</h1><p>Choose one student, or leave it as “All students” to notify every permitted device.</p></div></div>
    <Card className="record-form-card">
      <form className="record-form" onSubmit={send}>
        <label className="field"><span>Send to</span><select value={form.student} onChange={(event) => setForm({ ...form, student: event.target.value })}><option value="">All students / all devices</option>{students.map((student) => <option key={student._id} value={student._id}>{student.name} — {student.email || student.mobileNo || 'Student'}</option>)}</select></label>
        <label className="field"><span>Title</span><input value={form.title} maxLength="120" placeholder="e.g. Class reminder" onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label className="field"><span>Message</span><textarea value={form.description} maxLength="500" placeholder="Write the notification message" onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <div className="form-actions"><button type="submit" className="primary-button" disabled={sending}><FiSend /> {sending ? 'Sending…' : 'Send notification'}</button></div>
      </form>
    </Card>
    <div className="section-heading notification-list-heading"><div><FiBell /><h2>Recent notifications</h2></div>{user?.role === 'superadmin' && notifications.length ? <div className="notification-actions"><button type="button" className="secondary-button" onClick={selectAll}>{selectedIds.length === notifications.length ? 'Clear selection' : 'Select all'}</button><button type="button" className="danger-button" disabled={!selectedIds.length || deleting} onClick={removeSelected}><FiTrash2 /> {deleting ? 'Deleting…' : `Delete permanently (${selectedIds.length})`}</button></div> : null}</div>
    <div className="record-list">{notifications.length ? notifications.map((item) => <Card key={item._id} className="record-row notification-row">{user?.role === 'superadmin' ? <input type="checkbox" aria-label={`Select ${item.title}`} checked={selectedIds.includes(item._id)} onChange={() => toggleSelection(item._id)} /> : null}<div><strong>{item.title}</strong><p>{item.description || 'No message'}</p></div><small>{item.student?.name ? `Sent to ${item.student.name}` : 'Sent to all students'}</small></Card>) : <Card className="student-empty">No notifications sent yet.</Card>}</div>
  </section>;
}
