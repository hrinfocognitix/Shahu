import { useEffect, useMemo, useState } from 'react';
import { FiBookOpen, FiCreditCard, FiExternalLink, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/axios';
import { environment } from '../../config/environment';

const categories = { notes: 'notes', papers: 'question-paper', lectures: 'lecture' };
const date = (value, locale) => (value ? new Date(value).toLocaleDateString(locale) : '—');
const money = (item, locale) =>
  Number(
    item?.paidAmountMinor != null ? item.paidAmountMinor / 100 : item?.paidAmount || 0
  ).toLocaleString(locale);
const asset = (value) =>
  value?.startsWith('http') ? value : `${environment.apiBaseUrl.replace(/\/api\/v1$/, '')}${value}`;

export function StudentWorkspace({ mode }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'mr' ? 'mr-IN' : 'en-IN';
  const [account, setAccount] = useState(null);
  const [courseId, setCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const enrollments = account?.enrollments || [];
  const courses = useMemo(
    () =>
      enrollments
        .filter((item) => item.status === 'active')
        .map((item) => item.course)
        .filter(Boolean),
    [enrollments]
  );
  const course = courses.find((item) => item._id === courseId);
  const subjects = course?.subjects || [];

  useEffect(() => {
    setLoading(true);
    apiClient
      .get('/course-purchases/me')
      .then((response) => setAccount(response.data.data))
      .catch((error) =>
        toast.error(error.response?.data?.message || t('student.loadAccountError'))
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (mode !== 'home') return;
    apiClient.get('/notifications', { params: { limit: 10 } })
      .then((response) => setNotifications(response.data.data || []))
      .catch(() => setNotifications([]));
  }, [mode]);

  useEffect(() => {
    setItems([]);
    setAnswers({});
    setResult(null);
    if (!courseId || !subjectId || ['home', 'courses', 'profile'].includes(mode)) return;
    const endpoint =
      mode === 'syllabus'
        ? '/learning/syllabus'
        : mode === 'tests'
          ? '/learning/questions'
          : mode === 'lectures'
            ? '/videos'
            : '/learning/files';
    const params = {
      course: courseId,
      subject: subjectId,
          ...(categories[mode] && mode !== 'lectures' ? { category: categories[mode] } : {}),
    };
    apiClient
      .get(endpoint, { params })
      .then((response) => setItems(response.data.data || []))
      .catch((error) =>
        toast.error(error.response?.data?.message || t('student.loadContentError'))
      );
  }, [courseId, subjectId, mode, t]);

  const submitTest = async () => {
    if (items.some((item) => !answers[item._id]))
      return toast.error(t('student.answerAll'), { autoClose: 7000 });
    try {
      const response = await apiClient.post('/learning/questions/submit', {
        course: courseId,
        subject: subjectId,
        answers: items.map((item) => ({ question: item._id, selectedOption: answers[item._id] })),
      });
      setResult(response.data.data);
      toast.success(t('student.testSuccess'), { autoClose: 7000 });
    } catch (error) {
      toast.error(error.response?.data?.message || t('student.testError'), { autoClose: 7000 });
    }
  };

  const pageMode = ['home', 'courses', 'syllabus', 'notes', 'papers', 'tests', 'lectures', 'profile'].includes(mode) ? mode : 'home';
  const eyebrow = t(`student.pages.${pageMode}.eyebrow`);
  const title = t(`student.pages.${pageMode}.title`);
  if (loading) return <div className="card student-empty">{t('student.loadingAccount')}</div>;
  return (
    <section className="student-workspace page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{t('student.authorizedOnly')}</p>
        </div>
      </div>
      {mode === 'home' && (
        <><div className="student-home-metrics">
          <article className="card">
            <FiUser />
            <span>{t('student.student')}</span>
            <b>{account?.student?.name}</b>
          </article>
          <article className="card">
            <FiBookOpen />
            <span>{t('student.activeCourses')}</span>
            <b>{courses.length}</b>
          </article>
          <article className="card">
            <FiCreditCard />
            <span>{t('student.payments')}</span>
            <b>{account?.transactions?.length || 0}</b>
          </article>
        </div>
        <section className="student-notifications">
          <h2>{t('student.notifications')}</h2>
          {notifications.length ? notifications.slice(0, 5).map((item) => (
            <article className="card" key={item._id}>
              <span>!</span><div><h3>{item.title}</h3><p>{item.description}</p><small>{date(item.createdAt, locale)}</small></div>
            </article>
          )) : <div className="card student-empty">{t('student.noNotifications')}</div>}
        </section></>
      )}
      {['home', 'courses'].includes(mode) && (
        <div className="student-course-list">
          {enrollments.map((item) => (
            <article className="card" key={item._id}>
              <div>
                <h3>{item.course?.name}</h3>
                <span className={`status-pill ${item.status}`}>{t(`student.status.${item.status}`, item.status)}</span>
              </div>
              <p>{t('student.purchaseId')}: {item.transaction?.purchaseId || '—'}</p>
              <p>
                {t('student.valid', { from: date(item.validFrom, locale), until: date(item.validUntil, locale), days: item.validityDays })}
              </p>
            </article>
          ))}
        </div>
      )}
      {mode === 'profile' && (
        <>
          <article className="card student-profile-card">
            <h2>{account?.student?.name}</h2>
            <p>{account?.student?.email}</p>
            <p>{account?.student?.profile?.mobile || account?.student?.profile?.phone || '—'}</p>
            <p>{account?.student?.profile?.address || '—'}</p>
          </article>
          <h2>{t('student.paymentHistory')}</h2>
          <div className="student-course-list">
            {(account?.transactions || []).map((item) => (
              <article className="card" key={item._id}>
                <div>
                  <h3>{item.course?.name}</h3>
                  <span className={`status-pill ${item.status}`}>{t(`student.status.${item.status}`, item.status)}</span>
                </div>
                <p>{t('student.purchaseId')}: {item.purchaseId || '—'}</p>
                <p>{t('student.transaction')}: {item.transactionReference}</p>
                <p>
                  {t('student.receipt')}: {item.receiptNumber || t('student.pendingVerification')} · {t('student.paid')} ₹
                  {money(item.pricing, locale)}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
      {!['home', 'courses', 'profile'].includes(mode) && (
        <>
          <div className="student-learning-filters">
            <select
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setSubjectId('');
              }}
            >
              <option value="">{t('student.selectCourse')}</option>
              {courses.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={subjectId}
              disabled={!course}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              <option value="">{t('student.selectSubject')}</option>
              {subjects.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="student-learning-list">
            {items.map((item, index) => (
              <article className="card" key={item._id}>
                <span>{index + 1}</span>
                <div>
                  <h3>{item.chapter || item.title || item.questionText}</h3>
                  <p>{item.topic || item.description}</p>
                  {mode === 'tests' &&
                    item.options?.map((option) => (
                      <label className="student-test-option" key={option.key}>
                        <input
                          type="radio"
                          name={item._id}
                          disabled={Boolean(result)}
                          checked={answers[item._id] === option.key}
                          onChange={() =>
                            setAnswers((current) => ({ ...current, [item._id]: option.key }))
                          }
                        />{' '}
                        {option.key}. {option.text}
                      </label>
                    ))}
                </div>
              {(item.downloadUrl || item.videoUrl || item.resourceUrl) && (
                <a href={asset(item.downloadUrl || item.videoUrl || item.resourceUrl)} target="_blank" rel="noreferrer">
                    <FiExternalLink /> {t('student.open')}
                  </a>
                )}
              </article>
            ))}
          </div>
          {mode === 'tests' && items.length > 0 && !result && (
            <button className="btn btn-primary" onClick={submitTest}>
              {t('student.submitTest')}
            </button>
          )}
          {result && (
            <div className="card student-test-result">
              <b>
                {result.score} / {result.maximumScore}
              </b>
              <span>{t('student.testCompleted')}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
