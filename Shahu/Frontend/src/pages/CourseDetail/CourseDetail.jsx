import { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiBookOpen, FiCalendar, FiClock, FiCreditCard, FiMapPin, FiPhone, FiTag } from 'react-icons/fi';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { environment } from '../../config/environment';

const emptyPurchaseForm = {
  name: '',
  age: '',
  address: '',
  mobileNo: '',
  transactionId: '',
  paymentMethod: 'gpay',
  paymentAccountId: '',
  paymentDate: new Date().toISOString().slice(0, 10),
  note: ''
};

function resolveAssetUrl(path) {
  const assetBase = environment.apiBaseUrl.replace(/\/api\/v1$/, '');
  if (!path) return `${assetBase}/uploads/course-default-poster.png`;
  return path.startsWith('http') ? path : `${assetBase}${path}`;
}

function formatPaymentLabel(account) {
  const payload = account?.payload || {};
  return payload.accountName || payload.upiId || payload.mobileNo || payload.accountNo || account?.title || 'Payment account';
}

export function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buyOpen, setBuyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [form, setForm] = useState(emptyPurchaseForm);

  useEffect(() => {
    let active = true;

    Promise.all([
      apiClient.get('/courses', { params: { status: 'active', limit: 100 } }),
      apiClient.get('/payment-accounts', { params: { limit: 100 } })
    ])
      .then(([courseResponse, accountResponse]) => {
        if (!active) return;
        const courses = courseResponse.data.data || [];
        const matchedCourse = courses.find(item => item._id === courseId);
        setCourse(matchedCourse || null);

        const accounts = accountResponse.data.data || [];
        setPaymentAccounts(accounts);
        setForm(current => ({
          ...current,
          paymentAccountId: accounts[0]?._id || ''
        }));
      })
      .catch(() => {
        if (!active) return;
        setCourse(null);
        setPaymentAccounts([]);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [courseId]);

  const selectedAccount = useMemo(
    () => paymentAccounts.find(item => item._id === form.paymentAccountId) || paymentAccounts[0] || null,
    [form.paymentAccountId, paymentAccounts]
  );

  const validityEnd = useMemo(() => {
    const days = Number(course?.durationDays || 0);
    if (!days || !form.paymentDate) return null;
    const date = new Date(form.paymentDate);
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [course?.durationDays, form.paymentDate]);

  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));

  const submitPurchase = async event => {
    event.preventDefault();
    if (!course) return;
    setSubmitting(true);

    try {
      await apiClient.post('/course-purchases', {
        ...form,
        courseId: course._id,
        amount: Number(course.fees || 0)
      });
      toast.success('Course purchase submitted successfully');
      setBuyOpen(false);
      setForm({
        ...emptyPurchaseForm,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentAccountId: paymentAccounts[0]?._id || ''
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to submit purchase');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="course-detail-shell"><p className="muted">Loading course…</p></main>;
  }

  if (!course) {
    return (
      <main className="course-detail-shell">
        <div className="course-detail-empty">
          <h1>Course not found</h1>
          <p>This course is not available right now.</p>
          <button className="btn" type="button" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="course-detail-shell">
      <section className="course-detail-hero" style={{ backgroundImage: `linear-gradient(180deg, rgb(31 24 18 / 40%), rgb(31 24 18 / 86%)), url(${resolveAssetUrl(course.imageUrl)})` }}>
        <Link to="/" className="course-detail-back">
          <FiArrowLeft /> Back to home
        </Link>
        <div className="course-detail-copy">
          <span className="eyebrow">Course Overview</span>
          <h1>{course.name}</h1>
          <p>{course.description || 'Structured course detail is available below.'}</p>
          <div className="course-detail-meta">
            <span><FiClock /> {course.duration || `${course.durationDays || 0} days`}</span>
            <span><FiCalendar /> {course.validity || `${course.durationDays || 0} days validity`}</span>
            <span><FiTag /> Rs. {Number(course.fees || 0).toLocaleString('en-IN')}</span>
          </div>
          <button className="btn hero-button" type="button" onClick={() => setBuyOpen(true)}>
            Buy this course <FiCreditCard />
          </button>
        </div>
      </section>

      <section className="course-detail-grid">
        <article className="course-summary-card">
          <h2>What you get</h2>
          <div className="detail-pill-row">
            {(course.highlights || []).map(item => <span key={item}>{item}</span>)}
          </div>
          <ul className="detail-list">
            {(course.benefits || []).map(item => <li key={item}>{item}</li>)}
          </ul>
        </article>

        <article className="course-summary-card">
          <h2>Where this helps</h2>
          <ul className="detail-list">
            {(course.useCases || []).map(item => <li key={item}>{item}</li>)}
          </ul>
        </article>
      </section>

      <section className="course-section-stack">
        <div className="section-header">
          <span className="eyebrow">Course Details</span>
          <h2>Syllabus, notes and question resources</h2>
        </div>
        {(course.detailSections || []).length ? (
          <div className="detail-section-grid">
            {course.detailSections.map(section => (
              <article key={`${section.title}-${section.description}`} className="detail-section-card">
                <h3>{section.title || 'Section'}</h3>
                {section.description ? <p>{section.description}</p> : null}
                <div className="detail-resource-list">
                  {(section.items || []).map(item => (
                    <div key={`${item.label}-${item.value}`} className="detail-resource-item">
                      <strong>{item.label || item.type}</strong>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="course-summary-card">
            <p>Detailed syllabus will be added by the academy soon.</p>
          </div>
        )}
      </section>

      <section className="course-purchase-info">
        <div className="section-header">
          <span className="eyebrow">Payment</span>
          <h2>Transfer payment to the admin account shown below</h2>
        </div>
        <div className="purchase-account-card">
          <h3>{formatPaymentLabel(selectedAccount)}</h3>
          {selectedAccount?.payload?.qrCode ? <img src={selectedAccount.payload.qrCode} alt="Payment QR code" className="payment-qr-preview" /> : null}
          <div className="payment-account-lines">
            {selectedAccount?.payload?.upiId ? <p><FiCreditCard /> UPI: {selectedAccount.payload.upiId}</p> : null}
            {selectedAccount?.payload?.mobileNo ? <p><FiPhone /> Mobile: {selectedAccount.payload.mobileNo}</p> : null}
            {selectedAccount?.payload?.accountNo ? <p><FiBookOpen /> Account No: {selectedAccount.payload.accountNo}</p> : null}
            {selectedAccount?.payload?.ifsc ? <p><FiMapPin /> IFSC: {selectedAccount.payload.ifsc}</p> : null}
          </div>
        </div>
      </section>

      {buyOpen ? (
        <div className="login-overlay" onMouseDown={() => setBuyOpen(false)}>
          <form className="student-form management-form purchase-form" onSubmit={submitPurchase} onMouseDown={event => event.stopPropagation()}>
            <h2>Register for {course.name}</h2>
            <p className="muted">Enter your details, transfer payment, then submit the transaction details.</p>
            <div className="student-fields">
              <Field label="Full name" value={form.name} onChange={value => update('name', value)} />
              <Field label="Age" type="number" value={form.age} onChange={value => update('age', value)} />
              <Field label="Mobile number" value={form.mobileNo} onChange={value => update('mobileNo', value)} />
              <Field label="Address" as="textarea" value={form.address} onChange={value => update('address', value)} />
              <label>
                <span>Payment method</span>
                <select value={form.paymentMethod} onChange={event => update('paymentMethod', event.target.value)}>
                  <option value="gpay">GPay</option>
                  <option value="phonepe">PhonePe</option>
                  <option value="bank-transfer">Bank Transfer</option>
                </select>
              </label>
              <label>
                <span>Admin account</span>
                <select value={form.paymentAccountId} onChange={event => update('paymentAccountId', event.target.value)}>
                  {paymentAccounts.map(account => (
                    <option value={account._id} key={account._id}>
                      {formatPaymentLabel(account)}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Transaction ID / UTR" value={form.transactionId} onChange={value => update('transactionId', value)} />
              <Field label="Payment date" type="date" value={form.paymentDate} onChange={value => update('paymentDate', value)} />
              <Field label="Note" as="textarea" required={false} value={form.note} onChange={value => update('note', value)} />
            </div>
            <div className="purchase-validity-box">
              <strong>Course validity</strong>
              <span>{course.durationDays || 0} days</span>
              {validityEnd ? <small>Estimated valid till {validityEnd}</small> : null}
            </div>
            <button className="btn modal-submit" type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit transaction'}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function Field({ label, type = 'text', value, onChange, required = true, as = 'input' }) {
  return (
    <label>
      <span>{label}</span>
      {as === 'textarea' ? (
        <textarea required={required} value={value} onChange={event => onChange(event.target.value)} />
      ) : (
        <input required={required} type={type} value={value} onChange={event => onChange(event.target.value)} />
      )}
    </label>
  );
}
