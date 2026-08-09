import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FiDatabase, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { apiClient } from '../../api/axios';
import { ROUTES } from '../../config/routes';

const blankSummary = { database: {}, records: {}, collections: [] };

export function SystemData() {
  const user = useSelector((state) => state.auth.user);
  const [summary, setSummary] = useState(blankSummary);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [summaryResponse, courseResponse, studentResponse] = await Promise.all([
        apiClient.get('/system-data/summary'),
        apiClient.get('/courses', { params: { limit: 1000, status: 'all' } }),
        apiClient.get('/students', { params: { limit: 1000 } }),
      ]);
      setSummary(summaryResponse.data.data || blankSummary);
      setCourses(courseResponse.data.data || []);
      setStudents(studentResponse.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load academy data usage.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.role === 'superadmin') load(); }, [user?.role]);

  const expected = action === 'course' ? 'DELETE COURSE' : action === 'student' ? 'DELETE STUDENT' : 'DELETE ALL ACADEMY DATA';
  const remove = async () => {
    if ((action === 'course' && !courseId) || (action === 'student' && !studentId)) return toast.error(`Select a ${action} first.`);
    if (confirmation !== expected) return toast.error(`Type ${expected} exactly to continue.`);
    setDeleting(true);
    try {
      const path = action === 'course' ? `/system-data/courses/${courseId}` : action === 'student' ? `/system-data/students/${studentId}` : '/system-data/all';
      const response = await apiClient.delete(path, { data: { confirmation } });
      toast.success(response.data.message || 'Data permanently deleted.');
      setConfirmation(''); setAction(''); setCourseId(''); setStudentId('');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete this data.');
    } finally { setDeleting(false); }
  };

  if (user?.role !== 'superadmin') return <Navigate replace to={ROUTES.dashboard} />;
  return <section className="system-data page-enter">
    <div className="page-heading"><div><p className="eyebrow">SUPERADMIN ONLY</p><h1>System data management</h1><p>Monitor MongoDB use and permanently remove selected academy data.</p></div><button className="secondary-button" disabled={loading} onClick={load} type="button"><FiRefreshCw /> Refresh</button></div>
    <section className="system-data-metrics">
      <article><FiDatabase /><span>MongoDB data</span><strong>{summary.database?.data || '0 B'}</strong><small>Storage: {summary.database?.storage || '0 B'} · Indexes: {summary.database?.indexes || '0 B'}</small></article>
      <article><span>Courses</span><strong>{summary.records?.courses || 0}</strong><small>{summary.records?.learningFiles || 0} learning files</small></article>
      <article><span>Students</span><strong>{summary.records?.students || 0}</strong><small>{summary.records?.enrollments || 0} enrollments</small></article>
      <article><span>Teachers</span><strong>{summary.records?.teachers || 0}</strong><small>Current user accounts</small></article>
    </section>
    <section className="card system-data-collections"><h2>MongoDB collection usage</h2><div className="system-data-table"><table><thead><tr><th>Collection</th><th>Documents</th><th>Data</th><th>Storage</th></tr></thead><tbody>{summary.collections?.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.documents.toLocaleString()}</td><td>{item.size}</td><td>{item.storage}</td></tr>)}</tbody></table></div></section>
    <section className="card system-data-danger"><div><p className="eyebrow">PERMANENT ACTIONS</p><h2>Delete academy records</h2><p>These actions cannot be undone. Course deletion also deletes associated learning files, enrollments, questions, attempts, and payments. Clearing academy data preserves only admin and superadmin accounts.</p></div>
      <div className="system-delete-options">
        <label><input checked={action === 'course'} name="delete-action" onChange={() => setAction('course')} type="radio" /> Delete one course and all dependent data</label>
        {action === 'course' ? <select onChange={(event) => setCourseId(event.target.value)} value={courseId}><option value="">Select course</option>{courses.map((course) => <option key={course._id} value={course._id}>{course.name} {course.courseCode ? `(${course.courseCode})` : ''}</option>)}</select> : null}
        <label><input checked={action === 'student'} name="delete-action" onChange={() => setAction('student')} type="radio" /> Delete one student and all dependent data</label>
        {action === 'student' ? <select onChange={(event) => setStudentId(event.target.value)} value={studentId}><option value="">Select student</option>{students.map((student) => <option key={student._id} value={student._id}>{student.name} · {student.email}</option>)}</select> : null}
        <label><input checked={action === 'all'} name="delete-action" onChange={() => setAction('all')} type="radio" /> Clear all academy data</label>
        {action ? <label className="field"><span>Type <b>{expected}</b> to confirm</span><input onChange={(event) => setConfirmation(event.target.value)} placeholder={expected} value={confirmation} /></label> : null}
        <button className="danger-button" disabled={!action || deleting} onClick={remove} type="button"><FiTrash2 /> {deleting ? 'Deleting permanently…' : 'Delete permanently'}</button>
      </div>
    </section>
  </section>;
}
