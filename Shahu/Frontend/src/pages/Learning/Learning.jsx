import { useEffect, useState } from 'react';
import { FiDownload, FiEdit2, FiFile, FiPlus, FiTrash2, FiUpload } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { environment } from '../../config/environment';
const assetBase = environment.apiBaseUrl.replace(/\/api\/v1\/?$/, '');
const resolveAssetUrl = (path) =>
  !path || /^https?:\/\//i.test(path)
    ? path
    : `${assetBase}${path.startsWith('/') ? '' : '/'}${path}`;
export function Learning() {
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [course, setCourse] = useState('');
  const [subject, setSubject] = useState('');
  const [tab, setTab] = useState('syllabus');
  const [items, setItems] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    Promise.all([
      apiClient.get('/courses', { params: { limit: 100, status: 'active' } }),
      apiClient.get('/subjects', { params: { limit: 100, status: 'active' } }),
    ]).then(([c, s]) => {
      setCourses(c.data.data || []);
      setSubjects(s.data.data || []);
    });
  }, []);
  const availableSubjects = subjects.filter(
    (item) =>
      !course ||
      (item.courses || []).some((id) => String(id._id || id) === course) ||
      String(item.course?._id || item.course || '') === course ||
      courses
        .find((c) => c._id === course)
        ?.subjects?.some((id) => String(id._id || id) === item._id)
  );
  const load = async () => {
    if (!course || !subject) return;
    setLoading(true);
    try {
      const path =
        tab === 'syllabus'
          ? '/learning/syllabus'
          : tab === 'files'
            ? '/learning/files'
            : '/learning/questions';
      const response = await apiClient.get(path, { params: { course, subject } });
      setItems(response.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load subject content');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [course, subject, tab]);
  const addSyllabus = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await apiClient.post('/learning/syllabus', {
        course,
        subject,
        chapter: data.get('chapter'),
        topic: data.get('topic'),
        description: data.get('description'),
        learningObjectives: String(data.get('objectives') || '')
          .split('\n')
          .filter(Boolean),
        displayOrder: Number(data.get('displayOrder') || 0),
        status: 'published',
      });
      event.currentTarget.reset();
      toast.success('Syllabus added');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to add syllabus');
    }
  };
  const uploadFile = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.append('course', course);
    data.append('subject', subject);
    try {
      await apiClient.post('/learning/files', data);
      event.currentTarget.reset();
      toast.success('Learning file uploaded');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to upload file');
    }
  };
  const previewExcel = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.append('course', course);
    data.append('subject', subject);
    try {
      const response = await apiClient.post('/learning/questions/preview', data);
      setPreview(response.data.data);
      toast.success('Excel file validated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to validate Excel file');
    }
  };
  const confirmImport = async () => {
    try {
      const response = await apiClient.post(`/learning/questions/import/${preview._id}`);
      toast.success(response.data.message);
      setPreview(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to import questions');
    }
  };
  const downloadTemplate = async () => {
    const response = await apiClient.get('/learning/questions/template', { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'question-template.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };
  const editItem = async (item) => {
    const current = item.chapter || item.title || '';
    const value = window.prompt(tab === 'syllabus' ? 'Chapter / unit title' : 'File title', current);
    if (value === null || !value.trim()) return;
    try {
      await apiClient.patch(
        tab === 'syllabus' ? `/learning/syllabus/${item._id}` : `/learning/files/${item._id}`,
        tab === 'syllabus' ? { chapter: value.trim() } : { title: value.trim() }
      );
      toast.success('Content updated');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update content');
    }
  };
  const removeItem = async (item) => {
    const reason = window.prompt('Reason for archiving this content');
    if (reason === null || !reason.trim()) return;
    if (!window.confirm('Archive this content? Existing history and file metadata will be preserved.')) return;
    try {
      await apiClient.delete(
        tab === 'syllabus' ? `/learning/syllabus/${item._id}` : `/learning/files/${item._id}`,
        { data: { reason: reason.trim() } }
      );
      toast.success('Content archived');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to archive content');
    }
  };
  return (
    <section className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SUBJECT CONTENT</p>
          <h1>Syllabus & learning</h1>
          <p>
            One unified workspace for syllabus, PDF/DOC learning files, and Excel question banks.
          </p>
        </div>
      </div>
      <div className="learning-selectors">
        <label>
          <span>Course</span>
          <select
            value={course}
            onChange={(event) => {
              setCourse(event.target.value);
              setSubject('');
            }}
          >
            <option value="">Select course</option>
            {courses.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Subject</span>
          <select
            value={subject}
            disabled={!course}
            onChange={(event) => setSubject(event.target.value)}
          >
            <option value="">Select subject</option>
            {availableSubjects.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="learning-tabs">
        {[
          ['syllabus', 'Syllabus'],
          ['files', 'Learning Files'],
          ['questions', 'Question Bank'],
        ].map(([key, label]) => (
          <button className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {!course || !subject ? (
        <div className="card student-empty">Select a course and subject to manage its content.</div>
      ) : (
        <div className="learning-layout">
          <aside>
            {tab === 'syllabus' ? (
              <form onSubmit={addSyllabus}>
                <h3>
                  <FiPlus /> Add syllabus unit
                </h3>
                <input required name="chapter" placeholder="Chapter / unit" />
                <input name="topic" placeholder="Topic" />
                <textarea name="description" placeholder="Description" />
                <textarea name="objectives" placeholder="Learning objectives, one per line" />
                <input type="number" name="displayOrder" placeholder="Display order" />
                <button className="btn btn-primary">Add syllabus</button>
              </form>
            ) : tab === 'files' ? (
              <form onSubmit={uploadFile}>
                <h3>
                  <FiUpload /> Upload learning file
                </h3>
                <input required name="title" placeholder="File title" />
                <textarea name="description" placeholder="Description" />
                <select required name="category" defaultValue="notes">
                  <option value="notes">Notes</option>
                  <option value="question-paper">Previous question paper</option>
                  <option value="lecture">Lecture resource</option>
                  <option value="other">Other learning file</option>
                </select>
                <input
                  required
                  name="file"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                />
                <button className="btn btn-primary">Upload file</button>
              </form>
            ) : (
              <form onSubmit={previewExcel}>
                <h3>
                  <FiUpload /> Upload question Excel
                </h3>
                <button type="button" className="text-button" onClick={downloadTemplate}>
                  <FiDownload /> Download template
                </button>
                <input
                  required
                  name="file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                />
                <button className="btn btn-primary">Validate and preview</button>
              </form>
            )}
          </aside>
          <main>
            {loading ? (
              <div className="card student-empty">Loading content…</div>
            ) : items.length ? (
              <div className="learning-item-list">
                {items.map((item, index) => (
                  <article key={item._id}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{item.chapter || item.title || item.questionText}</h3>
                      <p>
                        {item.topic ||
                          item.description ||
                          item.options
                            ?.map((option) => `${option.key}. ${option.text}`)
                            .join(' · ')}
                      </p>
                    </div>
                    {item.downloadUrl ? (
                      <a href={resolveAssetUrl(item.downloadUrl)} target="_blank" rel="noreferrer">
                        <FiFile /> Open
                      </a>
                    ) : null}
                    {tab !== 'questions' ? <div className="learning-row-actions">
                      <button type="button" onClick={() => editItem(item)} aria-label="Edit content"><FiEdit2 /></button>
                      <button type="button" className="danger" onClick={() => removeItem(item)} aria-label="Archive content"><FiTrash2 /></button>
                    </div> : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="card student-empty">
                No {tab.replace('-', ' ')} added for this subject yet.
              </div>
            )}
          </main>
        </div>
      )}
      {preview && (
        <div className="login-overlay">
          <div className="student-detail-panel">
            <h2>Question import preview</h2>
            <div className="import-summary">
              <span>
                <b>{preview.totalRows}</b>Total
              </span>
              <span>
                <b>{preview.validRows}</b>Valid
              </span>
              <span>
                <b>{preview.invalidRows}</b>Invalid
              </span>
            </div>
            <div className="import-preview-rows">
              {preview.rows.map((row) => (
                <div className={row.valid ? 'valid' : 'invalid'} key={row.rowNumber}>
                  <b>
                    Row {row.rowNumber}: {row.data.questionText || 'Empty question'}
                  </b>
                  {(row.validationErrors || []).map((error) => (
                    <small key={error}>{error}</small>
                  ))}
                </div>
              ))}
            </div>
            <div className="purchase-actions">
              <button onClick={() => setPreview(null)}>Cancel</button>
              <button disabled={!preview.validRows} onClick={confirmImport}>
                Import {preview.validRows} valid questions
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
