import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [course, setCourse] = useState(searchParams.get('course') || '');
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
              {student.purchasedCourses?.length ? (
                <div className="student-purchased-course-list">
                  {student.purchasedCourses.map((purchase, index) => (
                    <small key={`${purchase.course}-${index}`}>
                      {purchase.course}{purchase.courseCode ? ` · ${purchase.courseCode}` : ''} · {purchase.paymentMethod} · {money(purchase.paidAmount)} · {purchase.remainingDays ?? 0} days remaining
                    </small>
                  ))}
                </div>
              ) : null}
              <small>
                Valid {date(student.latestEnrollment?.validFrom)} — {date(student.latestEnrollment?.validUntil)} · {student.latestEnrollment?.remainingDays ?? 0} days remaining
              </small>
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
                <div className="student-identity">
                  <span>Age: {details.student.profile?.age || '—'}</span>
                  <span>Education: {details.student.profile?.educationQualification || '—'}</span>
                  <span>Address: {details.student.profile?.address || '—'}</span>
                </div>
                <button className="student-credential-button" onClick={issueTemporaryPassword}>
                  <FiKey /> Issue temporary password
                </button>
              </header>
              <section>
                <h3>Personal information saved from Android</h3>
                <div className="student-personal-grid">
                  {[
                    ['WhatsApp', details.student.profile?.whatsapp],
                    ['Address', details.student.profile?.address],
                    ['City', details.student.profile?.city],
                    ['State', details.student.profile?.state],
                    ['PIN code', details.student.profile?.pinCode],
                    ['Gender', details.student.profile?.gender],
                    ['Date of birth', date(details.student.profile?.dateOfBirth)],
                    ['Age', details.student.profile?.age],
                    ['Height', details.student.profile?.height ? `${details.student.profile.height} cm` : ''],
                    ['Weight', details.student.profile?.weight ? `${details.student.profile.weight} kg` : ''],
                    ['Education qualification', details.student.profile?.educationQualification],
                    ['School / college', details.student.profile?.schoolCollege],
                    ['Current class / course', details.student.profile?.currentClass],
                    ["Father's name", details.student.profile?.fatherName],
                    ["Mother's name", details.student.profile?.motherName],
                  ].map(([label, value]) => (
                    <div className="student-personal-field" key={label}>
                      <small>{label}</small>
                      <span>{value || '—'}</span>
                    </div>
                  ))}
                </div>
              </section>
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
                      Valid {date(enrollment.validFrom)} — {date(enrollment.validUntil)} · {enrollment.remainingDays ?? 0} days remaining
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
                      Renew / change validity
                    </button>
                  </div>
                ))}
              </section>
              <section>
                <h3>Mock-test performance</h3>
                {details.attempts?.length ? (
                  details.attempts.map((attempt) => {
                    const percent = attempt.maximumScore
                      ? Math.round((Number(attempt.score || 0) / Number(attempt.maximumScore)) * 100)
                      : 0;
                    return (
                      <div className="enrollment-card" key={attempt._id}>
                        <div>
                          <b>{attempt.mockTest?.originalFilename || 'Question practice'}</b>
                          <span className={`status-pill ${percent >= 40 ? 'active' : 'expired'}`}>
                            {percent}%
                          </span>
                        </div>
                        <p>{attempt.course?.name || 'Course'} · {attempt.subject?.name || 'Subject'}</p>
                        <p>Marks: <b>{attempt.score || 0} / {attempt.maximumScore || 0}</b> · Submitted {date(attempt.submittedAt)}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="muted">No mock-test attempts yet.</p>
                )}
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
                      Receipt email: {transaction.receiptEmailedAt ? `sent ${date(transaction.receiptEmailedAt)}` : transaction.receiptEmailError ? `not sent — ${transaction.receiptEmailError}` : 'not sent yet'}
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
                    <p>
                      Buyer: {transaction.buyer?.name || '—'} · {transaction.buyer?.email || '—'} · {transaction.buyer?.mobileNo || '—'}
                    </p>
                    <p>
                      Age: {transaction.buyer?.age || '—'} · Education: {transaction.buyer?.education || '—'} · Device UUID: {transaction.buyer?.deviceUuid || '—'}
                    </p>
                    <p>Address: {transaction.buyer?.address || '—'}</p>
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
