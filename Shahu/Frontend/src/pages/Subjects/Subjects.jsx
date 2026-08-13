import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen, FiDownload, FiEdit2, FiFile, FiPlus, FiTrash2, FiUpload, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';

import { apiClient } from '../../api/axios';

const emptyForm = {
  name: '',
  description: '',
  color: '#A8773E',
  status: 'active',
};

export function Subjects() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [mockTestSubject, setMockTestSubject] = useState(null);
  const mockTestFileInput = useRef(null);
  const [courses, setCourses] = useState([]);
  const [mockTest, setMockTest] = useState({ course: '', file: null, preview: null, loading: false });

  const load = async () => {
    const response = await apiClient.get('/subjects', { params: { limit: 100 } });
    setItems(response.data.data || []);
  };

  useEffect(() => {
    load().catch(() => toast.error('Unable to load subjects'));
  }, []);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreateForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const openEditForm = (subject) => {
    setEditing(subject);
    setForm({
      name: subject.name,
      description: subject.description || '',
      color: subject.color || '#A8773E',
      status: subject.status,
    });
  };

  const save = async (event) => {
    event.preventDefault();

    try {
      if (editing) {
        await apiClient.patch(`/subjects/${editing._id}`, form);
      } else {
        await apiClient.post('/subjects', form);
      }

      toast.success(`Subject ${editing ? 'updated' : 'created'}`);
      setForm(null);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save subject');
    }
  };

  const deleteSubject = async (subject) => {
    if (!window.confirm(`Delete ${subject.name}?`)) {
      return;
    }

    try {
      await apiClient.delete(`/subjects/${subject._id}`);
      toast.success('Subject deleted');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete subject');
    }
  };

  const openMaterialWorkspace = (subject, type = 'syllabus') => {
    navigate(`/learning?subject=${encodeURIComponent(subject._id)}&type=${encodeURIComponent(type)}`);
  };
  const openMockTest = async (subject) => {
    setMockTestSubject(subject);
    setMockTest({ course: '', file: null, preview: null, loading: false });
    try {
      const response = await apiClient.get('/courses', { params: { limit: 100 } });
      setCourses((response.data.data || []).filter((course) =>
        [...(course.subjects || []), ...(course.subjectDetails || []).map((item) => item.subject)]
          .some((item) => String(item?._id || item) === String(subject._id))
      ));
    } catch {
      toast.error('Unable to load courses for this subject');
    }
  };
  const downloadTemplate = async () => {
    try {
      const response = await apiClient.get('/learning/questions/template', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = 'mock-test-template.xlsx'; link.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Unable to download the template'); }
  };
  const previewMockTest = async (event) => {
    event.preventDefault();
    if (!mockTest.course || !mockTest.file) return toast.error('Choose a course and an Excel or CSV file');
    const data = new FormData();
    data.append('course', mockTest.course);
    data.append('subject', mockTestSubject._id);
    data.append('file', mockTest.file);
    setMockTest((current) => ({ ...current, loading: true }));
    try {
      // A large question bank can take several minutes to validate on the server.
      const response = await apiClient.post('/learning/questions/preview', data, { timeout: 10 * 60 * 1000 });
      setMockTest((current) => ({ ...current, preview: response.data.data, loading: false }));
    } catch (error) {
      setMockTest((current) => ({ ...current, loading: false }));
      toast.error(error.response?.data?.message || 'Unable to validate mock-test file');
    }
  };
  const importMockTest = async () => {
    try {
      const response = await apiClient.post(`/learning/questions/import/${mockTest.preview._id}`, {}, { timeout: 10 * 60 * 1000 });
      toast.success(response.data.message || 'Mock test imported');
      setMockTestSubject(null);
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to import mock test'); }
  };

  return (
    <section className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SUBJECT MASTER</p>
          <h1>Subjects</h1>
          <p>Unique active subjects used by teacher and course assignment dropdowns.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateForm}>
          <FiPlus /> Add subject
        </button>
      </div>

      <div className="subject-master-grid">
        {items.map((item) => (
          <article className="card" key={item._id}>
            <div>
              <span className="subject-code">
                <i
                  aria-hidden="true"
                  className="subject-color-dot"
                  style={{ backgroundColor: item.color || '#A8773E' }}
                />
                <b>{item.subjectCode || item.subjectId || 'Code pending'}</b>
              </span>
              <span className={`status-pill ${item.status}`}>{item.status}</span>
            </div>
            <h3>{item.name || 'Unnamed subject'}</h3>
            <p>{item.description || 'No description added'}</p>
            <small>Created {new Date(item.createdAt).toLocaleDateString('en-IN')}</small>
            <div className="subject-card-actions">
              <button className="text-button" onClick={() => openMaterialWorkspace(item)}>
                <FiBookOpen /> Syllabus
              </button>
              <button className="text-button" onClick={() => openMockTest(item)}>
                <FiUpload /> Mock test
              </button>
              <button className="text-button" onClick={() => openEditForm(item)}>
                <FiEdit2 /> Edit
              </button>
              <button
                className="text-button subject-delete-button"
                onClick={() => deleteSubject(item)}
              >
                <FiTrash2 /> Delete
              </button>
            </div>
            <div className="subject-material-actions">
              <span><FiFile /> Add material</span>
              <button className="text-button" onClick={() => openMaterialWorkspace(item, 'notes')}>Notes</button>
              <button className="text-button" onClick={() => openMaterialWorkspace(item, 'generated-questions')}>Questions</button>
              <button className="text-button" onClick={() => openMaterialWorkspace(item, 'question-paper')}>Old papers</button>
              <button className="text-button" onClick={() => openMaterialWorkspace(item, 'other')}>Other</button>
            </div>
          </article>
        ))}
      </div>

      {form ? (
        <div className="login-overlay">
          <form className="student-form validity-form" onSubmit={save}>
            <button
              className="modal-close"
              onClick={() => setForm(null)}
              type="button"
            >
              <FiX />
            </button>
            <h2>{editing ? 'Update' : 'Add'} subject</h2>

            {editing ? (
              <label>
                <span>Subject code</span>
                <input readOnly value={editing.subjectCode} />
              </label>
            ) : (
              <p className="subject-code-hint">
                Subject code will be generated automatically from the subject name.
              </p>
            )}

            <label>
              <span>Subject name</span>
              <input
                onChange={(event) => updateForm('name', event.target.value)}
                required
                value={form.name}
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                onChange={(event) => updateForm('description', event.target.value)}
                value={form.description}
              />
            </label>
            <label>
              <span>Subject color</span>
              <input
                aria-label="Subject color"
                className="subject-color-input"
                onChange={(event) => updateForm('color', event.target.value)}
                type="color"
                value={form.color}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                onChange={(event) => updateForm('status', event.target.value)}
                value={form.status}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <button className="btn btn-primary">Save subject</button>
          </form>
        </div>
      ) : null}
      {mockTestSubject ? (
        <div className="login-overlay">
          <form className="student-form validity-form mock-test-upload-modal" onSubmit={previewMockTest}>
            <button className="modal-close" onClick={() => setMockTestSubject(null)} type="button"><FiX /></button>
            <p className="eyebrow">MOCK TEST</p>
            <h2>Upload questions for {mockTestSubject.name}</h2>
            <p className="subject-code-hint">Use the Marathi template columns exactly: क्रमांक, प्रकरण, प्रश्न, पर्याय अ, पर्याय ब, पर्याय क, पर्याय ड, योग्य उत्तर, स्पष्टीकरण. In योग्य उत्तर, enter अ, ब, क, ड, the full option text, or A–D.</p>
            <button className="text-button" onClick={downloadTemplate} type="button"><FiDownload /> Download Excel template</button>
            <label><span>Course</span><select required value={mockTest.course} onChange={(event) => setMockTest((current) => ({ ...current, course: event.target.value, preview: null }))}><option value="">Select course</option>{courses.map((course) => <option key={course._id} value={course._id}>{course.name}</option>)}</select></label>
            <label><span>Excel or CSV file (.xlsx, .csv)</span><input aria-hidden="true" className="mock-test-file-input" ref={mockTestFileInput} tabIndex={-1} type="file" onChange={(event) => setMockTest((current) => ({ ...current, file: event.target.files?.[0] || null, preview: null }))} /><button className="btn mock-test-file-button" onClick={() => mockTestFileInput.current?.click()} type="button"><FiUpload /> Choose file from Mac</button><b className="mock-test-file-name">{mockTest.file?.name || 'No file selected'}</b><small>Browse any file, then the app checks that it is .xlsx or .csv. Mac Numbers files must be exported first: File → Export To → Excel or CSV.</small></label>
            {!mockTest.preview ? <button className="btn btn-primary" disabled={mockTest.loading}>{mockTest.loading ? 'Checking file…' : 'Validate questions'}</button> : <div className="mock-test-preview"><b>Total questions: {mockTest.preview.totalRows} · Accepted: {mockTest.preview.validRows} · Duplicate questions ignored: {mockTest.preview.duplicateRows || 0} · Rejected: {mockTest.preview.invalidRows}</b>{mockTest.preview.invalidRows ? <ul>{mockTest.preview.rows.filter((row) => !row.valid && !row.skipped && row.validationErrors?.length).slice(0, 5).map((row) => <li key={row.rowNumber}>Row {row.rowNumber}: {row.validationErrors.join(', ')}</li>)}</ul> : null}<button className="btn btn-primary" onClick={importMockTest} type="button">Save accepted questions</button></div>}
          </form>
        </div>
      ) : null}
    </section>
  );
}
