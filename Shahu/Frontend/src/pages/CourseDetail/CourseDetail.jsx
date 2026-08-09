import { useEffect, useState } from 'react';
import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiSmartphone,
  FiTag,
} from 'react-icons/fi';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/axios';
import { environment } from '../../config/environment';

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function resolveAssetUrl(path) {
  const assetBase = environment.apiBaseUrl.replace(/\/api\/v1$/, '');
  if (!path) return `${assetBase}/uploads/course-default-poster.png`;
  return path.startsWith('http') ? path : `${assetBase}${path}`;
}

export function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [buyer, setBuyer] = useState({ name: '', email: '', mobileNo: '' });

  useEffect(() => {
    let active = true;

    apiClient
      .get('/courses', { params: { status: 'active', limit: 100 } })
      .then((courseResponse) => {
        if (!active) return;
        const courses = courseResponse.data.data || [];
        const matchedCourse = courses.find((item) => item._id === courseId);
        setCourse(matchedCourse || null);
      })
      .catch(() => {
        if (!active) return;
        setCourse(null);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [courseId]);

  const startCheckout = async () => {
    if (!buyer.name.trim() || !buyer.email.trim() || !buyer.mobileNo.trim()) {
      setPaymentMessage('Enter your name, email, and mobile number before payment.');
      return;
    }
    setPaying(true);
    setPaymentMessage('');
    try {
      const scriptLoaded = await loadRazorpayCheckout();
      if (!scriptLoaded) throw new Error('Unable to load the secure Razorpay checkout. Check your internet connection.');
      const orderResponse = await apiClient.post('/payments/checkout/order', { courseId, ...buyer });
      const order = orderResponse.data.data;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'GS BY Anand Sir',
        description: order.courseName || 'Course Payment',
        order_id: order.order_id,
        prefill: { name: buyer.name, email: buyer.email, contact: buyer.mobileNo },
        theme: { color: '#5E4B3C' },
        modal: { ondismiss: () => { setPaying(false); setPaymentMessage('Payment window closed. No payment was confirmed.'); } },
        handler: async (response) => {
          try {
            await apiClient.post('/payments/checkout/verify', { paymentId: order.paymentId, ...response }, { headers: { 'X-Payment-Token': order.paymentToken } });
            setPaymentMessage('Payment verified successfully. Your course access is being activated.');
          } catch (error) {
            setPaymentMessage(error.response?.data?.message || 'Payment could not be verified. Please contact support if money was debited.');
          } finally { setPaying(false); }
        },
      });
      checkout.on('payment.failed', () => { setPaying(false); setPaymentMessage('Payment failed or was cancelled. No amount was credited to the course.'); });
      checkout.open();
    } catch (error) {
      setPaymentMessage(error.response?.data?.message || error.message || 'Unable to start payment.');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <main className="course-detail-shell">
        <p className="muted">Loading course…</p>
      </main>
    );
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
      <section
        className="course-detail-hero"
        style={{
          backgroundImage: `linear-gradient(180deg, rgb(31 24 18 / 40%), rgb(31 24 18 / 86%)), url(${resolveAssetUrl(course.imageUrl)})`,
        }}
      >
        <Link to="/" className="course-detail-back">
          <FiArrowLeft /> Back to home
        </Link>
        <div className="course-detail-copy">
          <span className="eyebrow">Course Overview</span>
          <h1>{course.name}</h1>
          <p>{course.description || 'Structured course detail is available below.'}</p>
          {course.offerText ? (
            <div className="course-detail-offer">
              <b>{course.discountPercent ? `${course.discountPercent}% OFF` : 'SPECIAL OFFER'}</b>
              <span>{course.offerText}</span>
            </div>
          ) : null}
          <div className="course-detail-meta">
            <span>
              <FiClock /> {course.duration || `${course.durationDays || 0} days`}
            </span>
            <span>
              <FiCalendar /> {course.validity || `${course.durationDays || 0} days validity`}
            </span>
            <span>
              <FiTag />{' '}
              {course.actualPrice ? (
                <del>Rs. {Number(course.actualPrice).toLocaleString('en-IN')}</del>
              ) : null}{' '}
              Rs. {Number(course.fees || 0).toLocaleString('en-IN')}{' '}
              {course.discountPercent ? `(${course.discountPercent}% off)` : ''}
            </span>
          </div>
          <div className="course-app-purchase-note">
            <FiSmartphone />
            <span>
              <b>Purchase through the Android app</b>Secure payment submission and course activation
              are available only in the student app.
            </span>
          </div>
        </div>
      </section>

      <section className="course-detail-grid">
        <article className="course-summary-card">
          <h2>What you get</h2>
          <div className="detail-pill-row">
            {(course.highlights || []).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <ul className="detail-list">
            {(course.benefits || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="course-summary-card">
          <h2>Where this helps</h2>
          <ul className="detail-list">
            {(course.useCases || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      {(course.subjectDetails || []).length ? (
        <section className="course-section-stack">
          <div className="section-header">
            <span className="eyebrow">Included Subjects</span>
            <h2>Subjects and course sections</h2>
          </div>
          <div className="detail-section-grid">
            {[...course.subjectDetails]
              .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
              .map((detail) => (
                <article className="detail-section-card" key={detail._id || detail.subject?._id || detail.subject}>
                  <h3>{detail.subject?.name || 'Course subject'}</h3>
                  {detail.description ? <p>{detail.description}</p> : null}
                  <ol className="detail-list">
                    {[...(detail.sections || [])]
                      .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
                      .map((section) => <li key={section._id || section.title}>{section.title}</li>)}
                  </ol>
                </article>
              ))}
          </div>
        </section>
      ) : null}

      <section className="course-section-stack">
        <div className="section-header">
          <span className="eyebrow">Course Details</span>
          <h2>Syllabus, notes and question resources</h2>
        </div>
        {(course.detailSections || []).length ? (
          <div className="detail-section-grid">
            {course.detailSections.map((section) => (
              <article
                key={`${section.title}-${section.description}`}
                className="detail-section-card"
              >
                <h3>{section.title || 'Section'}</h3>
                {section.description ? <p>{section.description}</p> : null}
                <div className="detail-resource-list">
                  {(section.items || []).map((item) => (
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
          <span className="eyebrow">Enrollment</span>
          <h2>Ready to join this course?</h2>
        </div>
        <div className="purchase-account-card">
          <FiCreditCard />
          <h3>Secure online payment</h3>
          <p>Pay the academy-set course fee through Razorpay Standard Checkout.</p>
          <div className="student-fields">
            <input placeholder="Your full name" value={buyer.name} onChange={(event) => setBuyer((value) => ({ ...value, name: event.target.value }))} />
            <input placeholder="Email address" type="email" value={buyer.email} onChange={(event) => setBuyer((value) => ({ ...value, email: event.target.value }))} />
            <input placeholder="Mobile number" inputMode="tel" value={buyer.mobileNo} onChange={(event) => setBuyer((value) => ({ ...value, mobileNo: event.target.value }))} />
          </div>
          {paymentMessage ? <p className="muted">{paymentMessage}</p> : null}
          <button className="btn btn-primary" type="button" disabled={paying} onClick={startCheckout}>
            {paying ? 'Opening secure payment…' : `Pay ₹${Number(course.fees || 0).toFixed(2)}`}
          </button>
        </div>
      </section>
    </main>
  );
}
