import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FiCreditCard, FiDownload, FiPercent, FiTrendingUp } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { Card } from '../../components/Card/Card';
import { dashboardService } from '../../services/dashboard.service';

const money = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const emptyData = {
  totals: {},
  series: [],
  courses: [],
  statusCounts: [],
  paymentAccounts: [],
  enrollmentCounts: [],
};

export function Reports() {
  const [period, setPeriod] = useState('month');
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    course: '',
    paymentAccount: '',
    status: 'successful',
    student: '',
  });
  const [masters, setMasters] = useState({ courses: [], accounts: [] });
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(
      () =>
        dashboardService
          .purchases(period, filters)
          .then(setData)
          .catch((error) =>
            toast.error(error.response?.data?.message || 'Unable to load purchase analytics')
          )
          .finally(() => setLoading(false)),
      250
    );
    return () => clearTimeout(timer);
  }, [period, filters]);
  useEffect(() => {
    Promise.all([
      apiClient.get('/courses', { params: { limit: 100 } }),
      apiClient.get('/payment-accounts', { params: { limit: 100 } }),
    ])
      .then(([courses, accounts]) =>
        setMasters({ courses: courses.data.data || [], accounts: accounts.data.data || [] })
      )
      .catch(() => {});
  }, []);
  const updateFilter = (event) =>
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  const exportCsv = () => {
    const rows = [
      ['Course', 'Purchases', 'Revenue'],
      ...data.courses.map((item) => [item.courseName, item.purchases, item.revenue]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `course-purchases-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="reports-page page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PURCHASE ANALYTICS</p>
          <h1>Course performance</h1>
          <p>
            Android course purchases, revenue, payment channels, transaction states, and
            enrollments.
          </p>
        </div>
        <div className="report-actions">
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last 12 months</option>
          </select>
          <button className="btn btn-primary" onClick={exportCsv} disabled={!data.courses.length}>
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>
      <Card className="report-filters">
        <label>
          <span>From date</span>
          <input type="date" name="from" value={filters.from} onChange={updateFilter} />
        </label>
        <label>
          <span>To date</span>
          <input
            type="date"
            name="to"
            min={filters.from}
            value={filters.to}
            onChange={updateFilter}
          />
        </label>
        <label>
          <span>Course</span>
          <select name="course" value={filters.course} onChange={updateFilter}>
            <option value="">All courses</option>
            {masters.courses.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Payment account</span>
          <select name="paymentAccount" value={filters.paymentAccount} onChange={updateFilter}>
            <option value="">All accounts</option>
            {masters.accounts.map((item) => (
              <option key={item._id} value={item._id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Payment status</span>
          <select name="status" value={filters.status} onChange={updateFilter}>
            <option value="successful">Successful</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label>
          <span>Student</span>
          <input
            name="student"
            value={filters.student}
            onChange={updateFilter}
            placeholder="Name, email or mobile"
          />
        </label>
      </Card>
      {loading ? (
        <Card className="student-empty">Loading purchase analytics…</Card>
      ) : (
        <>
          <div className="report-metrics">
            <Card>
              <FiCreditCard />
              <span>Matching purchases</span>
              <b>{data.totals.purchases || 0}</b>
            </Card>
            <Card>
              <FiTrendingUp />
              <span>Transaction value</span>
              <b>{money(data.totals.revenue)}</b>
            </Card>
            <Card>
              <FiCreditCard />
              <span>Average order</span>
              <b>{money(data.totals.averageOrder)}</b>
            </Card>
            <Card>
              <FiPercent />
              <span>Discount value</span>
              <b>{money(data.totals.discountGiven)}</b>
            </Card>
          </div>
          <div className="report-grid">
            <Card className="report-chart">
              <div className="card-heading">
                <div>
                  <p className="section-kicker">PURCHASE TREND</p>
                  <h2>Count and transaction value</h2>
                </div>
              </div>
              {data.series.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(value, name) => (name === 'revenue' ? money(value) : value)}
                    />
                    <Bar dataKey="purchases" fill="#8f765f" radius={[7, 7, 0, 0]} />
                    <Bar dataKey="revenue" fill="#c45353" radius={[7, 7, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="student-empty">No purchases match these filters.</div>
              )}
            </Card>
            <PerformanceList
              title="Course-wise purchases"
              kicker="COURSE DEMAND"
              items={data.courses.map((item) => ({
                id: item.courseId,
                name: item.courseName,
                count: item.purchases,
                value: item.revenue,
              }))}
            />
          </div>
          <div className="report-grid">
            <PerformanceList
              title="Payment-account-wise"
              kicker="PAYMENT CHANNELS"
              items={data.paymentAccounts.map((item) => ({
                id: item.paymentAccountId,
                name: item.accountName,
                count: item.purchases,
                value: item.revenue,
              }))}
            />
            <Card className="course-performance">
              <div className="card-heading">
                <div>
                  <p className="section-kicker">SUBSCRIPTIONS</p>
                  <h2>Enrollment status</h2>
                </div>
              </div>
              {data.enrollmentCounts.map((item) => (
                <div className="course-performance-row" key={item.status}>
                  <span>{item.count}</span>
                  <div>
                    <b>{item.status}</b>
                    <small>course enrollments</small>
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
              <div className="report-status-list">
                {data.statusCounts.map((item) => (
                  <span className={`status-pill ${item.status}`} key={item.status}>
                    {item.status}: {item.count}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}

function PerformanceList({ title, kicker, items }) {
  return (
    <Card className="course-performance">
      <div className="card-heading">
        <div>
          <p className="section-kicker">{kicker}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {items.length ? (
        items.map((item, index) => (
          <div className="course-performance-row" key={item.id || item.name}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <b>{item.name}</b>
              <small>{item.count} purchases</small>
            </div>
            <strong>{money(item.value)}</strong>
          </div>
        ))
      ) : (
        <div className="student-empty">No matching data.</div>
      )}
    </Card>
  );
}
