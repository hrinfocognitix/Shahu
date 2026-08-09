import { useEffect, useState } from 'react';
import { FiActivity, FiBookOpen, FiCreditCard, FiFileText, FiShield, FiTrash2, FiUsers } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card/Card';
import { ROUTES } from '../../config/routes';
import { apiClient } from '../../api/axios';

const actions = [
  ['Students', ROUTES.students, FiUsers, 'View student records and performance'],
  ['Teachers', ROUTES.teachers, FiUsers, 'Manage teacher records'],
  ['Courses', ROUTES.courses, FiBookOpen, 'Course and subject reporting'],
  ['Payment Accounts', ROUTES.paymentAccounts, FiCreditCard, 'Collections and payment details'],
  ['Reports', ROUTES.reports, FiFileText, 'Purchase and academy reports'],
  ['Audit Logs', ROUTES.auditLogs, FiActivity, 'Every recorded admin action'],
  ['Deleted Items', ROUTES.deletedRecords, FiTrash2, 'Review and permanently delete records'],
  ['System Data', ROUTES.systemData, FiTrash2, 'View MongoDB usage and clear academy data'],
];

export function SuperAdminDashboard() {
  const [stats, setStats] = useState({ students: 0, teachers: 0, courses: 0, appInstallations: 0, revenue: 0, activeEnrollments: 0 });
  const [activity, setActivity] = useState([]);
  useEffect(() => {
    Promise.all([apiClient.get('/dashboard/stats'), apiClient.get('/audit-logs', { params: { limit: 8 } })])
      .then(([statsResponse, activityResponse]) => { setStats(statsResponse.data.data || {}); setActivity(activityResponse.data.data || []); })
      .catch(() => undefined);
  }, []);
  return <section className="superadmin-dashboard page-enter">
    <div className="page-heading"><div><p className="eyebrow">SUPERADMIN DASHBOARD</p><h1>Academy control center</h1><p>All academy reports, administration options, and permanent-record controls.</p></div><Link className="danger-button" to={ROUTES.deletedRecords}><FiTrash2 /> Permanently delete data</Link></div>
    <div className="stats-grid"><Card className="metric-card metric-students"><FiUsers /><div><small>Total students</small><span>{stats.students || 0}</span><strong>{stats.activeEnrollments || 0} active enrolments</strong></div></Card><Card className="metric-card metric-teachers"><FiShield /><div><small>Teachers</small><span>{stats.teachers || 0}</span><strong>{stats.courses || 0} active courses</strong></div></Card><Card className="metric-card metric-courses"><FiCreditCard /><div><small>Total collection</small><span>₹{Number(stats.revenue || 0).toLocaleString('en-IN')}</span><strong>{stats.verifiedPurchases || 0} verified payments</strong></div></Card><Card className="metric-card metric-content"><FiActivity /><div><small>Mobile installations</small><span>{stats.appInstallations || 0}</span><strong>Unique Android devices</strong></div></Card></div>
    <section className="superadmin-action-grid">{actions.map(([title, path, Icon, copy]) => <Link className="card superadmin-action" key={path} to={path}><Icon /><div><strong>{title}</strong><span>{copy}</span></div></Link>)}</section>
    <Card className="superadmin-activity"><div className="card-heading"><div><p className="section-kicker">LATEST ADMIN RECORDS</p><h2>Recent activity</h2></div><Link to={ROUTES.auditLogs}>View all</Link></div>{activity.length ? <div className="audit-list">{activity.map((item) => <article key={item._id}><div><strong>{String(item.action || 'Activity').replaceAll('_', ' ')}</strong><p>{item.module || 'system'} · {item.user?.name || item.user?.email || 'System'}</p></div><small>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : '—'}</small></article>)}</div> : <p className="muted">No activity records available.</p>}</Card>
  </section>;
}
