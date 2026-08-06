import { useEffect, useMemo, useState } from 'react';
import { FiBookOpen, FiCreditCard, FiEye, FiUser, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/axios';
import { environment } from '../../config/environment';

// Use the same published learning-file categories as the Android app.
const categories = { syllabus: 'syllabus-copy', notes: 'notes', papers: 'question-paper' };
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
  const [mockTests, setMockTests] = useState([]);
  const [selectedMockTest, setSelectedMockTest] = useState(null);
  const [mockQuestions, setMockQuestions] = useState([]);
  const [mockPage, setMockPage] = useState({ page: 1, total: 0, totalPages: 1 });
  const [mockAnswers, setMockAnswers] = useState({});
  const [mockReview, setMockReview] = useState(null);
  const [mockScores, setMockScores] = useState({});
  const [completedMockPages, setCompletedMockPages] = useState(new Set());
  const [mockLoading, setMockLoading] = useState(false);
  const [mockSubmitting, setMockSubmitting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [profileForm, setProfileForm] = useState({ name: '', whatsapp: '', address: '', city: '', state: '', pinCode: '', gender: '', dateOfBirth: '', age: '', height: '', weight: '', educationQualification: '', schoolCollege: '', currentClass: '', fatherName: '', motherName: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
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
  const maximumBirthDate = useMemo(() => {
    const value = new Date();
    value.setFullYear(value.getFullYear() - 14);
    return value.toISOString().slice(0, 10);
  }, []);

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
    const student = account?.student;
    const profile = student?.profile || {};
    if (!student) return;
    setProfileForm({
      name: student.name || '', whatsapp: profile.whatsapp || '', address: profile.address || '', city: profile.city || '', state: profile.state || '', pinCode: profile.pinCode || '', gender: profile.gender || '',
      dateOfBirth: profile.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '', age: profile.age || '', height: profile.height || '', weight: profile.weight || '', educationQualification: profile.educationQualification || '', schoolCollege: profile.schoolCollege || '', currentClass: profile.currentClass || '', fatherName: profile.fatherName || '', motherName: profile.motherName || '',
    });
  }, [account]);
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
    if (!courseId || !subjectId || ['home', 'courses', 'profile', 'tests'].includes(mode)) return;
    const endpoint =
      mode === 'tests'
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
  useEffect(() => {
    setMockTests([]); setSelectedMockTest(null); setMockQuestions([]); setMockReview(null);
    if (mode !== 'tests' || !courseId || !subjectId) return;
    apiClient.get('/learning/mock-tests', { params: { course: courseId, subject: subjectId } })
      .then((response) => setMockTests(response.data.data || []))
      .catch((error) => toast.error(error.response?.data?.message || 'Unable to load mock tests.'));
  }, [courseId, subjectId, mode]);

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
  const loadMockPage = async (test, page) => {
    setMockLoading(true); setMockReview(null); setMockAnswers({});
    try {
      const response = await apiClient.get(`/learning/mock-tests/${test._id}/questions`, { params: { page, limit: 20 } });
      setMockQuestions(response.data.data || []);
      setMockPage(response.data.meta || { page, total: 0, totalPages: 1 });
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to load this test page.'); }
    finally { setMockLoading(false); }
  };
  const openMockTest = async (test) => {
    setSelectedMockTest(test); setMockLoading(true); setMockScores({}); setCompletedMockPages(new Set());
    try {
      const progressResponse = await apiClient.get(`/learning/mock-tests/${test._id}/progress`);
      const progress = progressResponse.data.data || [];
      const complete = new Set(progress.map((item) => Number(item.page)));
      setCompletedMockPages(complete);
      setMockScores(Object.fromEntries(progress.map((item) => [Number(item.page), { score: item.score, maximumScore: item.maximumScore }])));
      const firstIncomplete = Array.from({ length: Math.max(...progress.map((item) => Number(item.page)), 1) + 1 }, (_, index) => index + 1).find((page) => !complete.has(page)) || 1;
      await loadMockPage(test, firstIncomplete);
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to load saved marks.'); }
    finally { setMockLoading(false); }
  };
  const submitMockPage = async () => {
    if (mockQuestions.some((question) => !mockAnswers[question._id])) return toast.error('Answer all 20 questions before submitting this page.');
    setMockSubmitting(true);
    try {
      const response = await apiClient.post('/learning/questions/submit', { course: selectedMockTest.course, subject: selectedMockTest.subject?._id || subjectId, mockTest: selectedMockTest._id, mockPage: mockPage.page, answers: mockQuestions.map((question) => ({ question: question._id, selectedOption: mockAnswers[question._id] })) });
      const review = response.data.data?.answers || [];
      setMockReview(review);
      setCompletedMockPages((current) => new Set(current).add(mockPage.page));
      setMockScores((current) => ({ ...current, [mockPage.page]: { score: response.data.data?.score || 0, maximumScore: response.data.data?.maximumScore || 0 } }));
      toast.success('Test page submitted. Your marks are saved.');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to submit this test page.'); }
    finally { setMockSubmitting(false); }
  };
  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    try {
      let photo = account?.student?.profile?.photo;
      if (profilePhoto) {
        const formData = new FormData();
        formData.append('file', profilePhoto);
        const upload = await apiClient.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        photo = upload.data.data?.url;
      }
      const { name, ...profile } = profileForm;
      const response = await apiClient.patch('/users/me', { name, profile: { ...profile, photo } });
      setAccount((current) => ({ ...current, student: response.data.data }));
      setProfilePhoto(null);
      toast.success('Personal information saved.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save personal information.');
    } finally { setProfileSaving(false); }
  };
  const updatePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword.length < 8) return toast.error('New password must contain at least 8 characters.');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return toast.error('New passwords do not match.');
    setPasswordSaving(true);
    try {
      await apiClient.patch('/users/me/password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated successfully. Please sign in again on other devices.');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update password.'); }
    finally { setPasswordSaving(false); }
  };
  const previewUrl = previewItem ? asset(previewItem.previewUrl || previewItem.videoUrl || previewItem.resourceUrl || `${previewItem.downloadUrl || ''}${previewItem.downloadUrl ? '&inline=1' : ''}`) : '';
  const previewType = String(previewItem?.mimeType || '').toLowerCase();

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
          <form className="card student-profile-form" onSubmit={saveProfile}>
            <div className="student-profile-heading">
              {profilePhoto ? <img alt="Selected profile" src={URL.createObjectURL(profilePhoto)} /> : account?.student?.profile?.photo ? <img alt="Profile" src={asset(account.student.profile.photo)} /> : <span>{(profileForm.name || 'S').charAt(0).toUpperCase()}</span>}
              <div><h2>Personal information</h2><p>Update the same profile details available in the Android app.</p></div>
            </div>
            <label className="profile-photo-input"><span>Profile photo</span><input accept="image/*" onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)} type="file" /></label>
            <div className="student-profile-fields">
              {[['name', 'Full name', 'text'], ['whatsapp', 'WhatsApp number', 'tel'], ['address', 'Address', 'text'], ['city', 'City', 'text'], ['state', 'State', 'text'], ['pinCode', 'PIN code', 'text'], ['gender', 'Gender', 'text'], ['age', 'Age', 'number'], ['height', 'Height (cm)', 'number'], ['weight', 'Weight (kg)', 'number'], ['educationQualification', 'Education qualification', 'text'], ['schoolCollege', 'School / college', 'text'], ['currentClass', 'Current class / course', 'text'], ['fatherName', "Father's name", 'text'], ['motherName', "Mother's name", 'text']].map(([key, label, type]) => <label key={key}><span>{label}</span><input type={type} value={profileForm[key]} onChange={(event) => setProfileForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
              <label><span>Date of birth</span><input max={maximumBirthDate} type="date" value={profileForm.dateOfBirth} onChange={(event) => setProfileForm((current) => ({ ...current, dateOfBirth: event.target.value }))} /></label>
              <label><span>Registered email</span><input readOnly value={account?.student?.email || ''} /></label>
              <label><span>Mobile number</span><input readOnly value={account?.student?.profile?.mobile || account?.student?.profile?.phone || ''} /></label>
            </div>
            <button className="btn btn-primary" disabled={profileSaving} type="submit">{profileSaving ? 'Saving…' : 'Save personal information'}</button>
          </form>
          <form className="card student-password-form" onSubmit={updatePassword}>
            <h2>Update password</h2><p>Use at least 8 characters. Updating it signs out other devices.</p>
            <div className="student-profile-fields"><label><span>Current password</span><input required type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} /></label><label><span>New password</span><input required type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} /></label><label><span>Confirm new password</span><input required type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} /></label></div>
            <button className="btn btn-primary" disabled={passwordSaving} type="submit">{passwordSaving ? 'Updating…' : 'Update password'}</button>
          </form>
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
          {mode === 'tests' ? (
            <section className="student-mock-tests">
              {!courseId || !subjectId ? <div className="card student-empty">Select a course and subject to view mock tests.</div> : !selectedMockTest ? (
                mockTests.length ? <div className="student-course-list">{mockTests.map((test) => <article className="card" key={test._id}><div><h3>{test.originalFilename || 'Mock Test'}</h3><span className="status-pill active">{test.validRows || test.totalRows || 0} questions</span></div><p>{test.subject?.name || 'Selected subject'}</p><button className="btn btn-primary" onClick={() => { void openMockTest(test); }} type="button">Start / continue test</button></article>)}</div> : <div className="card student-empty">No mock test has been published for this subject.</div>
              ) : <>
                <div className="student-mock-header"><button className="student-preview-button" onClick={() => setSelectedMockTest(null)} type="button">← All tests</button><div><h2>{selectedMockTest.originalFilename || 'Mock Test'}</h2><p>Page {mockPage.page} of {mockPage.totalPages} · 20 questions per page</p></div>{mockScores[mockPage.page] ? <strong className="student-mock-score">{mockScores[mockPage.page].score} / {mockScores[mockPage.page].maximumScore}</strong> : null}</div>
                <div className="student-mock-pages">{Array.from({ length: mockPage.totalPages }, (_, index) => index + 1).map((page) => { const complete = completedMockPages.has(page); const unlocked = page === 1 || complete || completedMockPages.has(page - 1); return <button className={`${page === mockPage.page ? 'current' : ''} ${complete ? 'complete' : ''}`} disabled={!unlocked || mockLoading} key={page} onClick={() => { if (page !== mockPage.page) void loadMockPage(selectedMockTest, page); }} type="button">{page}</button>; })}</div>
                {mockLoading ? <div className="card student-empty">Loading test questions…</div> : <div className="student-learning-list">{mockQuestions.map((item, index) => { const review = mockReview?.find((answer) => String(answer.question) === String(item._id)); return <article className="card" key={item._id}><span className="student-question-number">Que. {(mockPage.page - 1) * 20 + index + 1}</span><div><h3>{item.questionText}</h3>{item.questionImage ? <img alt="Question" className="student-question-image" src={asset(item.questionImage)} /> : null}{item.options?.map((option) => { const selected = mockAnswers[item._id] === option.key; const correct = review?.correctOption === option.key; return <label className={`student-test-option ${review && selected ? (correct ? 'is-correct' : 'is-wrong') : ''} ${review && correct ? 'is-correct' : ''}`} key={option.key}><input checked={selected} disabled={Boolean(mockReview)} name={item._id} onChange={() => setMockAnswers((current) => ({ ...current, [item._id]: option.key }))} type="radio" /> {option.key}. {option.text}</label>; })}{review ? <section className={`student-answer-review ${review.correct ? 'correct' : 'wrong'}`}><b>{review.correct ? '✓ Correct Answer' : '✕ Wrong Answer'}</b>{!review.correct ? <p><strong>Correct Answer:</strong> {item.options?.find((option) => option.key === review.correctOption)?.text || '—'}</p> : null}<p><strong>Explanation:</strong> {review.explanation || 'No explanation provided.'}</p></section> : null}</div></article>; })}</div>}
                {mockQuestions.length && !mockLoading ? <div className="student-mock-actions"><button className="student-preview-button" disabled={mockPage.page <= 1 || mockLoading} onClick={() => { void loadMockPage(selectedMockTest, mockPage.page - 1); }} type="button">Previous</button>{mockReview ? <button className="student-preview-button" onClick={() => { setMockReview(null); setMockAnswers({}); }} type="button">Retest page</button> : <button className="btn btn-primary" disabled={mockSubmitting} onClick={() => { void submitMockPage(); }} type="button">{mockSubmitting ? 'Submitting…' : completedMockPages.has(mockPage.page) ? 'Submit retest' : 'Submit test'}</button>}<button className="student-preview-button" disabled={!completedMockPages.has(mockPage.page) || mockPage.page >= mockPage.totalPages || mockLoading} onClick={() => { void loadMockPage(selectedMockTest, mockPage.page + 1); }} type="button">Next</button></div> : null}
              </>}
            </section>
          ) : <>
          <div className="student-learning-list">
            {items.map((item, index) => (
              <article className="card" key={item._id}>
                <span>{mode === 'tests' ? `${index + 1}/${items.length}` : index + 1}</span>
                <div>
                  <h3>{item.chapter || item.title || item.questionText}</h3>
                  <p>{item.topic || item.description}</p>
                  {mode === 'tests' && item.questionImage ? <img alt="Question" className="student-question-image" src={asset(item.questionImage)} /> : null}
                  {mode === 'tests' &&
                    item.options?.map((option) => {
                      const review = result?.answers?.find((answer) => String(answer.question) === String(item._id));
                      const isSelected = answers[item._id] === option.key;
                      const isCorrect = review?.correctOption === option.key;
                      return <label className={`student-test-option ${result && isSelected ? (isCorrect ? 'is-correct' : 'is-wrong') : ''} ${result && isCorrect ? 'is-correct' : ''}`} key={option.key}>
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
                        {item.optionImages?.[option.key] ? <img alt={`Option ${option.key}`} className="student-option-image" src={asset(item.optionImages[option.key])} /> : null}
                      </label>;
                    })}
                  {mode === 'tests' && result ? (() => {
                    const review = result.answers?.find((answer) => String(answer.question) === String(item._id));
                    const selected = item.options?.find((option) => option.key === answers[item._id]);
                    const correct = item.options?.find((option) => option.key === review?.correctOption);
                    return review ? <section className={`student-answer-review ${review.correct ? 'correct' : 'wrong'}`}><b>{review.correct ? '✓ Correct Answer' : '✕ Wrong Answer'}</b><p><strong>Your Answer:</strong> {selected?.text || '—'}</p>{!review.correct ? <p><strong>Correct Answer:</strong> {correct?.text || '—'}</p> : null}<p><strong>Explanation:</strong> {review.explanation || 'No explanation provided.'}</p>{item.explanationImage ? <img alt="Explanation" className="student-question-image" src={asset(item.explanationImage)} /> : null}<div className="student-concept"><b>📘 Concept</b><span>{item.topic || item.chapter || 'Key concept'}</span><i>↓</i><span>{review.explanation || 'Review the explanation'}</span></div></section> : null;
                  })() : null}
                </div>
              {(item.previewUrl || item.videoUrl || item.resourceUrl || item.downloadUrl) && <button className="student-preview-button" onClick={() => { setPreviewZoom(1); setPreviewItem(item); }} type="button"><FiEye /> Preview</button>}
              </article>
            ))}
          </div>
          </>}
        </>
      )}
      {previewItem && <div className="learning-preview-overlay" onMouseDown={() => setPreviewItem(null)}>
        <section aria-label="Learning file preview" className="learning-preview-modal" onMouseDown={(event) => event.stopPropagation()}>
          <header><div><p className="eyebrow">PREVIEW</p><h2>{previewItem.title || previewItem.originalFilename || 'Learning file'}</h2></div><div className="learning-preview-tools">{previewType.startsWith('image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(previewUrl) ? <><button aria-label="Zoom out" disabled={previewZoom <= 1} onClick={() => setPreviewZoom((value) => Math.max(1, value - .25))} type="button">−</button><button aria-label="Zoom in" disabled={previewZoom >= 3} onClick={() => setPreviewZoom((value) => Math.min(3, value + .25))} type="button">+</button></> : null}<button aria-label="Close preview" onClick={() => setPreviewItem(null)} type="button"><FiX /></button></div></header>
          <div className="learning-preview-content">
            {previewType.startsWith('video/') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(previewUrl) ? <video controls controlsList="nodownload" src={previewUrl} /> : previewType.startsWith('image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(previewUrl) ? <div className="learning-preview-image"><img alt={previewItem.title || 'Learning preview'} src={previewUrl} style={{ transform: `scale(${previewZoom})` }} /></div> : <iframe src={previewUrl} title={previewItem.title || 'Learning file preview'} />}
          </div>
        </section>
      </div>}
    </section>
  );
}
