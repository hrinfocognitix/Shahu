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

      <section className="course-purchase-info course-app-only">
        <div className="section-header">
          <span className="eyebrow">Enrollment</span>
          <h2>Ready to join this course?</h2>
        </div>
        <div className="purchase-account-card">
          <FiCreditCard />
          <h3>Open Lokaraja Career Academy on Android</h3>
          <p>
            Select this course in the app to view its assigned payment options and submit
            transaction details securely.
          </p>
        </div>
      </section>
    </main>
  );
}
