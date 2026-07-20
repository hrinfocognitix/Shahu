import { useEffect, useState } from 'react';
import {
  FiCalendar,
  FiCreditCard,
  FiDownload,
  FiKey,
  FiSearch,
  FiSmartphone,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';

const date = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—');
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export function Students() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [course, setCourse] = useState('');
  const [purchaseFrom, setPurchaseFrom] = useState('');
  const [purchaseTo, setPurchaseTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [courses, setCourses] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [validity, setValidity] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/course-purchases/students', {
        params: { page, limit: 20, search, status, course, purchaseFrom, purchaseTo, sort },
      });
      setStudents(response.data.data || []);
      setMeta(response.data.meta || { totalPages: 1, total: 0 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load students');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [page, search, status, course, purchaseFrom, purchaseTo, sort]);
  useEffect(() => {
    apiClient
      .get('/courses', { params: { limit: 100 } })
      .then((response) => setCourses(response.data.data || []))
      .catch(() => {});
  }, []);

  const openStudent = async (student) => {
    setDetailsLoading(true);
    try {
      const response = await apiClient.get(`/course-purchases/students/${student._id}`);
      setDetails(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load student details');
    } finally {
      setDetailsLoading(false);
    }
  };
  const saveValidity = async (event) => {
    event.preventDefault();
    try {
      await apiClient.patch(`/course-purchases/enrollments/${validity.id}/validity`, validity);
      toast.success('Course validity updated');
      setValidity(null);
      const response = await apiClient.get(`/course-purchases/students/${details.student._id}`);
      setDetails(response.data.data);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update validity');
    }
  };
  const issueTemporaryPassword = async () => {
    const reason = window.prompt('Reason for issuing a new temporary password');
    if (!reason) return;
    try {
      const response = await apiClient.post(
        `/course-purchases/students/${details.student._id}/reset-password`,
        { reason }
      );
      setCredentials(response.data.data);
      toast.success('Temporary password issued and existing sessions revoked');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to issue temporary password');
    }
  };
  const exportStudents = async () => {
    try {
      const response = await apiClient.get('/course-purchases/students', {
        params: {
          search,
          status,
          course,
          purchaseFrom,
          purchaseTo,
          sort,
          export: true,
          limit: 5000,
        },
      });
      const rows = [
        [
          'Name',
          'Email',
          'Mobile',
          'Device UUID',
          'Registered',
          'Purchased courses',
          'Current status',
          'Valid until',
        ],
        ...(response.data.data || []).map((item) => [
          item.name,
          item.email,
          item.profile?.mobile || item.profile?.phone,
          item.deviceUuid,
          item.createdAt,
          item.purchasedCourseCount,
          item.latestEnrollment?.status || 'no-purchase',
          item.latestEnrollment?.validUntil || '',
        ]),
      ];
      const csv = rows
        .map((row) =>
          row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')
        )
        .join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student-enrollments.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to export students');
    }
  };

  return (
    <section className="student-management page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">STUDENT MANAGEMENT</p>
          <h1>Purchased-course students</h1>
          <p>
            Students are created only after an Android payment is verified. Mobile, email and device
            UUID remain read-only.
          </p>
        </div>
        <div className="student-heading-actions">
          <span className="student-total">{meta.total || 0} students</span>
          <button className="btn btn-primary" onClick={exportStudents}>
            <FiDownload /> Export
          </button>
        </div>
      </div>
      <div className="student-toolbar">
        <label>
          <FiSearch />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email or mobile"
          />
        </label>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All enrollment statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="blocked">Blocked</option>
          <option value="no-purchase">No purchase</option>
        </select>
        <select
          value={course}
          onChange={(event) => {
            setCourse(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All courses</option>
          {courses.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Purchase from"
          type="date"
          value={purchaseFrom}
          onChange={(event) => {
            setPurchaseFrom(event.target.value);
            setPage(1);
          }}
        />
        <input
          aria-label="Purchase to"
          type="date"
          min={purchaseFrom}
          value={purchaseTo}
          onChange={(event) => {
            setPurchaseTo(event.target.value);
            setPage(1);
          }}
        />
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Newest registration</option>
          <option value="name">Name A–Z</option>
          <option value="validity">Validity ending soon</option>
        </select>
      </div>
      {loading ? (
        <div className="card student-empty">Loading students…</div>
      ) : students.length ? (
        <div className="student-card-grid">
          {students.map((student) => (
            <button
              className="student-summary-card"
              key={student._id}
              onClick={() => openStudent(student)}
            >
              <div className="student-avatar">
                <FiUser />
              </div>
              <div>
                <h3>{student.name}</h3>
                <p>{student.email}</p>
                <p>{student.profile?.mobile || student.profile?.phone || 'No mobile'}</p>
              </div>
              <div className="student-summary-stats">
                <span>
                  <b>{student.purchasedCourseCount || 0}</b> courses
                </span>
                <span className={`status-pill ${student.latestEnrollment?.status || ''}`}>
                  {student.latestEnrollment?.status || 'no purchase'}
                </span>
              </div>
              <small>Valid until {date(student.latestEnrollment?.validUntil)}</small>
              <small>
                <FiSmartphone /> {student.deviceUuid || 'UUID not supplied'}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <div className="card student-empty">No purchased-course students match these filters.</div>
      )}
      <div className="student-pagination">
        <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
          Previous
        </button>
        <span>
          {page} / {meta.totalPages || 1}
        </span>
        <button disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>
          Next
        </button>
      </div>
      {(details || detailsLoading) && (
        <div className="login-overlay" onMouseDown={() => setDetails(null)}>
          {detailsLoading ? (
            <div className="student-detail-panel">Loading details…</div>
          ) : (
            <article
              className="student-detail-panel"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button className="modal-close" onClick={() => setDetails(null)}>
                <FiX />
              </button>
              <header>
                <p className="eyebrow">STUDENT DETAILS</p>
                <h2>{details.student.name}</h2>
                <div className="student-identity">
                  <span>{details.student.email}</span>
                  <span>
                    {details.student.profile?.mobile || details.student.profile?.phone || '—'}
                  </span>
                  <span>Joined {date(details.student.createdAt)}</span>
                </div>
                <button className="student-credential-button" onClick={issueTemporaryPassword}>
                  <FiKey /> Issue temporary password
                </button>
              </header>
              <section>
                <h3>
                  <FiSmartphone /> Registered devices
                </h3>
                {details.devices.length ? (
                  details.devices.map((device) => (
                    <div className="student-detail-row" key={device._id}>
                      <b>{device.uuid}</b>
                      <span>
                        {device.platform} · last seen {date(device.lastSeenAt)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No device UUID has been supplied yet.</p>
                )}
              </section>
              <section>
                <h3>
                  <FiCalendar /> Purchased courses and validity
                </h3>
                {details.enrollments.map((enrollment) => (
                  <div className="enrollment-card" key={enrollment._id}>
                    <div>
                      <b>{enrollment.course?.name}</b>
                      <span className={`status-pill ${enrollment.status}`}>
                        {enrollment.status}
                      </span>
                    </div>
                    <p>
                      Purchased {date(enrollment.purchaseDate)} · {enrollment.validityDays} days
                    </p>
                    <p>
                      Valid {date(enrollment.validFrom)} — {date(enrollment.validUntil)}
                    </p>
                    <button
                      onClick={() =>
                        setValidity({
                          id: enrollment._id,
                          validFrom: new Date(enrollment.validFrom).toISOString().slice(0, 10),
                          validUntil: new Date(enrollment.validUntil).toISOString().slice(0, 10),
                          reason: '',
                        })
                      }
                    >
                      Change validity
                    </button>
                  </div>
                ))}
              </section>
              <section>
                <h3>
                  <FiCreditCard /> Transactions
                </h3>
                {details.transactions.map((transaction) => (
                  <div className="transaction-detail-card" key={transaction._id}>
                    <div>
                      <b>{transaction.course?.name}</b>
                      <span className={`status-pill ${transaction.status}`}>
                        {transaction.status}
                      </span>
                    </div>
                    <p>
                      Purchase ID: {transaction.purchaseId || 'Legacy pending migration'} ·{' '}
                      {transaction.transactionReference} · {transaction.paymentMethod}
                    </p>
                    <p>
                      Gateway: {transaction.gatewayReference || '—'} · Receipt:{' '}
                      {transaction.receiptNumber || '—'}
                    </p>
                    <p>
                      Original {money(transaction.pricing?.originalPrice)} · Discount{' '}
                      {transaction.pricing?.discountPercent || 0}% · Paid{' '}
                      {money(transaction.pricing?.paidAmount)}
                    </p>
                    <p>
                      {date(transaction.paymentDate)} · Account:{' '}
                      {transaction.paymentAccount?.title || '—'}
                    </p>
                  </div>
                ))}
              </section>
            </article>
          )}
        </div>
      )}
      {validity && (
        <div className="login-overlay">
          <form className="student-form validity-form" onSubmit={saveValidity}>
            <button type="button" className="modal-close" onClick={() => setValidity(null)}>
              <FiX />
            </button>
            <h2>Override course validity</h2>
            <label>
              <span>Valid from</span>
              <input
                required
                type="date"
                value={validity.validFrom}
                onChange={(event) =>
                  setValidity((current) => ({ ...current, validFrom: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Valid until</span>
              <input
                required
                type="date"
                min={validity.validFrom}
                value={validity.validUntil}
                onChange={(event) =>
                  setValidity((current) => ({ ...current, validUntil: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Reason for manual change</span>
              <textarea
                required
                value={validity.reason}
                onChange={(event) =>
                  setValidity((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </label>
            <button className="btn btn-primary">Save validity</button>
          </form>
        </div>
      )}
      {credentials && (
        <div className="login-overlay">
          <article className="student-form credential-panel">
            <button className="modal-close" onClick={() => setCredentials(null)}>
              <FiX />
            </button>
            <p className="eyebrow">ONE-TIME CREDENTIAL</p>
            <h2>Student temporary password</h2>
            <p>Share this securely with the student. It will not be displayed again.</p>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{credentials.email}</dd>
              </div>
              <div>
                <dt>Temporary password</dt>
                <dd className="temporary-password">{credentials.temporaryPassword}</dd>
              </div>
            </dl>
            <button className="btn btn-primary" onClick={() => setCredentials(null)}>
              I have saved it securely
            </button>
          </article>
        </div>
      )}
    </section>
  );
}
