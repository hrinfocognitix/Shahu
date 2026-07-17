import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Card } from '../../components/Card/Card';
import { FiArrowUpRight, FiBookOpen, FiCheckCircle, FiClock, FiFileText, FiPlayCircle, FiTrendingUp, FiUserCheck, FiUsers } from 'react-icons/fi';
import { dashboardService } from '../../services/dashboard.service';

const data = [
  { name: 'Mon', value: 12 },
  { name: 'Tue', value: 18 },
  { name: 'Wed', value: 14 },
  { name: 'Thu', value: 24 },
  { name: 'Fri', value: 21 }
];

const activities = [
  { icon: FiUserCheck, title: 'Student records are ready to review', detail: 'Keep enrolments and contact information up to date.', time: 'Today' },
  { icon: FiFileText, title: 'Learning resources need attention', detail: 'Review notes, materials, and question papers.', time: 'This week' },
  { icon: FiPlayCircle, title: 'Video lectures are available', detail: 'Organize the latest sessions for your learners.', time: 'Content' }
];

export function Dashboard() {
  const [stats, setStats] = useState({ students: 0, teachers: 0, courses: 0, subjects: 0, materials: 0, videos: 0, exams: 0, attendance: 0 });
  useEffect(() => { dashboardService.stats().then(setStats).catch(() => setStats({ students: 0, teachers: 0, courses: 0, subjects: 0, materials: 0, videos: 0, exams: 0, attendance: 0 })); }, []);
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="dashboard-page">
      <div className="dashboard-welcome">
        <div><p className="dashboard-kicker">LOKARAJA CAREER ACADEMY</p><h1>Good day, Administrator.</h1><span>Here’s a clear view of your academy, learning resources, and daily progress.</span></div>
        <div className="dashboard-date"><FiClock /><span>{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span></div>
      </div>
      <div className="stats-grid">
        <Card className="metric-card metric-students"><FiUsers /><div><small>Total students</small><span>{stats.students}</span><strong><FiTrendingUp /> Enrolled learners</strong></div></Card>
        <Card className="metric-card metric-teachers"><FiUserCheck /><div><small>Active teachers</small><span>{stats.teachers}</span><strong><FiCheckCircle /> Teaching team</strong></div></Card>
        <Card className="metric-card metric-courses"><FiBookOpen /><div><small>Active courses</small><span>{stats.courses}</span><strong>{stats.subjects} subjects available</strong></div></Card>
        <Card className="metric-card metric-content"><FiFileText /><div><small>Learning content</small><span>{stats.materials + stats.videos}</span><strong>{stats.exams} online exams</strong></div></Card>
      </div>
      <div className="dashboard-main-grid"><Card className="analytics-card"><div className="card-heading"><div><p className="section-kicker">WEEKLY OVERVIEW</p><h2>Learning activity</h2></div><span className="trend-chip"><FiTrendingUp /> +18%</span></div><ResponsiveContainer width="100%" height={265}><AreaChart data={data} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}><defs><linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} /><stop offset="100%" stopColor="#0f766e" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="name" tickLine={false} axisLine={false} /><Tooltip cursor={{ stroke: '#dbe6e2', strokeWidth: 2 }} contentStyle={{ border: 0, borderRadius: 12, boxShadow: '0 12px 30px rgba(15, 45, 40, .14)' }} /><Area type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={3} fill="url(#activityFill)" /></AreaChart></ResponsiveContainer></Card><Card className="overview-card"><div className="card-heading"><div><p className="section-kicker">ACADEMY SNAPSHOT</p><h2>At a glance</h2></div></div><div className="snapshot-list"><div><span>Study materials</span><strong>{stats.materials}</strong></div><div><span>Video lectures</span><strong>{stats.videos}</strong></div><div><span>Online exams</span><strong>{stats.exams}</strong></div><div><span>Attendance</span><strong>{stats.attendance || '—'}</strong></div></div><div className="overview-footer"><FiCheckCircle /><span>All academy data is in one place.</span></div></Card></div>
      <div className="dashboard-bottom-grid"><Card className="activity-card"><div className="card-heading"><div><p className="section-kicker">WORKSPACE</p><h2>Stay on track</h2></div><FiArrowUpRight /></div><div className="activity-list">{activities.map(({ icon: Icon, title, detail, time }) => <div className="activity-item" key={title}><span className="activity-icon"><Icon /></span><div><strong>{title}</strong><p>{detail}</p></div><small>{time}</small></div>)}</div></Card><Card className="action-card"><p className="section-kicker">QUICK ACTION</p><h2>Manage your academy with confidence.</h2><p>Update students, arrange course material, and keep your learning space ready for every class.</p><a href="/students">Open student management <FiArrowUpRight /></a></Card></div>
    </motion.section>
  );
}
