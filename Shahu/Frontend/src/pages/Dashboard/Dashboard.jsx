import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Card } from '../../components/Card/Card';
import {
  FiArrowUpRight,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiFileText,
  FiSmartphone,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi';
import { dashboardService } from '../../services/dashboard.service';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const shortDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

export function Dashboard() {
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    courses: 0,
    subjects: 0,
    materials: 0,
    videos: 0,
    exams: 0,
    attendance: 0,
    pendingPurchases: 0,
    activeEnrollments: 0,
    upcomingExpirations: [],
    verifiedPurchases: 0,
    revenue: 0,
    recentPurchases: [],
    appInstallations: 0,
  });
  const [purchases, setPurchases] = useState({ totals: {}, series: [] });
  useEffect(() => {
    dashboardService
      .stats()
      .then(setStats)
      .catch(() =>
        setStats({
          students: 0,
          teachers: 0,
          courses: 0,
          subjects: 0,
          materials: 0,
          videos: 0,
          exams: 0,
          attendance: 0,
          pendingPurchases: 0,
          activeEnrollments: 0,
          upcomingExpirations: [],
          verifiedPurchases: 0,
          revenue: 0,
          recentPurchases: [],
          appInstallations: 0,
        })
      );
    dashboardService
      .purchases('week')
      .then(setPurchases)
      .catch(() => setPurchases({ totals: {}, series: [] }));
  }, []);
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="dashboard-page"
    >
      <div className="dashboard-welcome">
        <div>
          <p className="dashboard-kicker">LOKARAJA CAREER ACADEMY</p>
          <h1>Good day, Administrator.</h1>
          <span>Here’s a clear view of your academy, learning resources, and daily progress.</span>
        </div>
        <div className="dashboard-date">
          <FiClock />
          <span>
            {new Intl.DateTimeFormat('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(new Date())}
          </span>
        </div>
      </div>
      <div className="stats-grid">
        <Card className="metric-card metric-students">
          <FiUsers />
          <div>
            <small>Total students</small>
            <span>{stats.students}</span>
            <strong>
              <FiTrendingUp /> Enrolled learners
            </strong>
          </div>
        </Card>
        <Card className="metric-card metric-teachers">
          <FiUserCheck />
          <div>
            <small>Active teachers</small>
            <span>{stats.teachers}</span>
            <strong>
              <FiCheckCircle /> Teaching team
            </strong>
          </div>
        </Card>
        <Card className="metric-card metric-courses">
          <FiBookOpen />
          <div>
            <small>Active courses</small>
            <span>{stats.courses}</span>
            <strong>{stats.subjects} subjects available</strong>
          </div>
        </Card>
        <Card className="metric-card metric-content">
          <FiFileText />
          <div>
            <small>Learning content</small>
            <span>{stats.materials + stats.videos}</span>
            <strong>{stats.exams} online exams</strong>
          </div>
        </Card>
        <Card className="metric-card metric-students">
          <FiSmartphone />
          <div>
            <small>App installations</small>
            <span>{stats.appInstallations}</span>
            <strong>Unique mobile devices</strong>
          </div>
        </Card>
      </div>
      <div className="dashboard-main-grid">
        <Card className="analytics-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">LAST 7 DAYS</p>
              <h2>Verified course purchases</h2>
            </div>
            <span className="trend-chip">
              <FiTrendingUp /> {purchases.totals.purchases || 0} sales
            </span>
          </div>
          {purchases.series.length ? (
            <ResponsiveContainer width="100%" height={265}>
              <AreaChart
                data={purchases.series}
                margin={{ top: 12, right: 4, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8f765f" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#8f765f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ stroke: '#dbe6e2', strokeWidth: 2 }}
                  contentStyle={{
                    border: 0,
                    borderRadius: 12,
                    boxShadow: '0 12px 30px rgba(15, 45, 40, .14)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  stroke="#8f765f"
                  strokeWidth={3}
                  fill="url(#activityFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="student-empty">No verified purchases in the last 7 days.</div>
          )}
        </Card>
        <Card className="overview-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">ACADEMY SNAPSHOT</p>
              <h2>At a glance</h2>
            </div>
          </div>
          <div className="snapshot-list">
            <div>
              <span>Active enrollments</span>
              <strong>{stats.activeEnrollments}</strong>
            </div>
            <div>
              <span>Pending verification</span>
              <strong>{stats.pendingPurchases}</strong>
            </div>
            <div>
              <span>Verified purchases</span>
              <strong>{stats.verifiedPurchases}</strong>
            </div>
            <div>
              <span>Total verified revenue</span>
              <strong>{money(stats.revenue)}</strong>
            </div>
          </div>
          <div className="overview-footer">
            <FiCheckCircle />
            <span>All academy data is in one place.</span>
          </div>
        </Card>
      </div>
      <div className="dashboard-bottom-grid">
        <Card className="activity-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">WORKSPACE</p>
              <h2>Recent course purchases</h2>
            </div>
            <FiArrowUpRight />
          </div>
          <div className="activity-list">
            {stats.recentPurchases.length ? (
              stats.recentPurchases.map((item) => (
                <div className="activity-item" key={item._id}>
                  <span className="activity-icon">
                    <FiCreditCard />
                  </span>
                  <div>
                    <strong>
                      {item.buyer?.name || 'Student'} · {item.course?.name || 'Course'}
                    </strong>
                    <p>
                      {item.transactionReference} ·{' '}
                      {money(
                        item.pricing?.paidAmountMinor != null
                          ? item.pricing.paidAmountMinor / 100
                          : item.pricing?.paidAmount
                      )}
                    </p>
                  </div>
                  <small className={`status-pill ${item.status}`}>{item.status}</small>
                </div>
              ))
            ) : (
              <div className="student-empty">No purchase submissions yet.</div>
            )}
          </div>
        </Card>
        <Card className="action-card">
          <p className="section-kicker">NEXT 7 DAYS</p>
          <h2>Upcoming course expirations</h2>
          {stats.upcomingExpirations.length ? (
            stats.upcomingExpirations.map((item) => (
              <p key={item._id}>
                <strong>{item.student?.name || 'Student'}</strong> · {item.course?.name || 'Course'}{' '}
                · {shortDate(item.validUntil)}
              </p>
            ))
          ) : (
            <p>No active enrollments expire in the next seven days.</p>
          )}
          <a href="/students">
            Review students and validity <FiArrowUpRight />
          </a>
        </Card>
      </div>
    </motion.section>
  );
}
