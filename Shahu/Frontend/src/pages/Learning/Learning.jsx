import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiEdit2, FiFile, FiPlus, FiTrash2, FiUpload } from 'react-icons/fi';
import { toast } from 'react-toastify';

import { apiClient } from '../../api/axios';
import { environment } from '../../config/environment';

const assetBase = environment.apiBaseUrl.replace(/\/api\/v1\/?$/, '');
const materialOptions = [
  ['syllabus', 'Syllabus copy'],
  ['notes', 'Notes'],
  ['generated-questions', 'Questions (Generated)'],
  ['question-paper', 'Old question paper'],
  ['mock-test', 'Mock test'],
  ['other', 'Other'],
];

const resolveAssetUrl = (path) =>
  !path || /^https?:\/\//i.test(path)
    ? path
    : `${assetBase}${path.startsWith('/') ? '' : '/'}${path}`;
const materialCategory = (type) => (type === 'syllabus' ? 'syllabus-copy' : type);
const createNoteEntry = () => ({
  id: `${Date.now()}-${Math.random()}`,
  title: '',
  unitTitle: '',
  description: '',
  file: null,
});
const createQuestionEntry = () => ({
  id: `${Date.now()}-${Math.random()}`,
  title: '',
  unitTitle: '',
  description: '',
  file: null,
});
const createQuestionPaperEntry = () => ({
  id: `${Date.now()}-${Math.random()}`,
  title: '',
  unitTitle: '',
  description: '',
  file: null,
});

export function Learning() {
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [course, setCourse] = useState(searchParams.get('course') || '');
  const [subject, setSubject] = useState(searchParams.get('subject') || '');
  const [selectedTypes, setSelectedTypes] = useState(['syllabus']);
  const [noteEntries, setNoteEntries] = useState([createNoteEntry()]);
  const [questionEntries, setQuestionEntries] = useState([createQuestionEntry()]);
  const [questionPaperEntries, setQuestionPaperEntries] = useState([createQuestionPaperEntry()]);
  const [mockTestFile, setMockTestFile] = useState(null);
  const [mockTestPreview, setMockTestPreview] = useState(null);
  const [mockTestLoading, setMockTestLoading] = useState(false);
  const [sourceCourse, setSourceCourse] = useState('');
  const [sourceSubject, setSourceSubject] = useState('');
  const [sourceMaterialCounts, setSourceMaterialCounts] = useState({});
  const [importTypes, setImportTypes] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get('/courses', { params: { limit: 100, status: 'active' } }),
      apiClient.get('/subjects', { params: { limit: 100, status: 'active' } }),
    ])
      .then(([courseResponse, subjectResponse]) => {
        setCourses(courseResponse.data.data || []);
        setSubjects(subjectResponse.data.data || []);
      })
      .catch(() => toast.error('Unable to load course and subject options'));
  }, []);

  useEffect(() => {
    if (!course || !subject) {
      setSelectedTypes([]);
      setItems([]);
      return undefined;
    }

    let isCurrentSelection = true;
    apiClient
      .get('/learning/files', { params: { course, subject } })
      .then((response) => {
        if (!isCurrentSelection) return;
        const savedTypes = [...new Set(
          (response.data.data || [])
            .map((item) => (item.category === 'syllabus-copy' ? 'syllabus' : item.category))
            .filter((type) => materialOptions.some(([key]) => key === type)),
        )];
        setSelectedTypes(savedTypes);
      })
      .catch(() => {
        if (isCurrentSelection) {
          setSelectedTypes([]);
          toast.error('Unable to load existing material types');
        }
      });

    return () => {
      isCurrentSelection = false;
    };
  }, [course, subject]);

  const availableSubjects = useMemo(
    () =>
      subjects.filter(
        (item) =>
          !course ||
          (item.courses || []).some((id) => String(id._id || id) === course) ||
          String(item.course?._id || item.course || '') === course ||
          courses
            .find((item) => item._id === course)
            ?.subjects?.some((id) => String(id._id || id) === item._id),
      ),
    [course, courses, subjects],
  );
  const sourceAvailableSubjects = useMemo(
    () =>
      subjects.filter((item) => {
        const belongsToSourceCourse =
          !sourceCourse ||
          (item.courses || []).some((id) => String(id._id || id) === sourceCourse) ||
          String(item.course?._id || item.course || '') === sourceCourse ||
          courses
            .find((courseItem) => courseItem._id === sourceCourse)
            ?.subjects?.some((id) => String(id._id || id) === item._id);
        return belongsToSourceCourse && !(sourceCourse === course && item._id === subject);
      }),
    [course, courses, sourceCourse, subject, subjects],
  );

  const documentTypes = selectedTypes;
  const savedNoteCount = useMemo(
    () => items.filter((item) => item.materialType === 'notes').length,
    [items],
  );
  const savedQuestionCount = useMemo(
    () => items.filter((item) => item.materialType === 'generated-questions').length,
    [items],
  );
  const savedQuestionPaperCount = useMemo(
    () => items.filter((item) => item.materialType === 'question-paper').length,
    [items],
  );

  const load = async () => {
    if (!course || !subject || !selectedTypes.length) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const fileResponses = await Promise.all(
        selectedTypes.map(async (type) => {
          const response = await apiClient.get('/learning/files', {
            params: { course, subject, category: materialCategory(type) },
          });
          return (response.data.data || []).map((item) => ({
            ...item,
            materialType: materialCategory(type),
          }));
        }),
      );
      setItems(fileResponses.flat());
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load subject content');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [course, subject, selectedTypes.join('|')]);

  useEffect(() => {
    if (!sourceCourse || !sourceSubject) {
      setSourceMaterialCounts({});
      setImportTypes([]);
      return undefined;
    }

    let isCurrentSource = true;
    apiClient
      .get('/learning/files', { params: { course: sourceCourse, subject: sourceSubject } })
      .then((response) => {
        if (!isCurrentSource) return;
        const counts = (response.data.data || []).reduce((result, item) => {
          const type = item.category === 'syllabus-copy' ? 'syllabus' : item.category;
          result[type] = (result[type] || 0) + 1;
          return result;
        }, {});
        setSourceMaterialCounts(counts);
        setImportTypes(Object.keys(counts));
      })
      .catch(() => {
        if (isCurrentSource) toast.error('Unable to load source material');
      });

    return () => {
      isCurrentSource = false;
    };
  }, [sourceCourse, sourceSubject]);

  const toggleMaterialType = (type) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  };

  const toggleImportType = (type) => {
    setImportTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  };

  const importMaterial = async (event) => {
    event.preventDefault();
    if (!sourceCourse || !sourceSubject || !importTypes.length) {
      toast.error('Select a source course, subject, and at least one material type');
      return;
    }
    try {
      const response = await apiClient.post('/learning/files/import', {
        course,
        subject,
        sourceCourse,
        sourceSubject,
        categories: importTypes.map(materialCategory),
      });
      toast.success(response.data.message || 'Material imported');
      setSourceCourse('');
      setSourceSubject('');
      setImportTypes([]);
      // Import can add a material type that was not previously selected.
      // Reload every saved type now, rather than waiting for a tab toggle.
      const refreshed = await apiClient.get('/learning/files', { params: { course, subject } });
      const importedItems = (refreshed.data.data || []).map((item) => ({
        ...item,
        materialType: item.category === 'syllabus-copy' ? 'syllabus' : item.category,
      }));
      const refreshedTypes = [...new Set(
        importedItems
          .map((item) => item.materialType)
          .filter((type) => materialOptions.some(([key]) => key === type)),
      )];
      setSelectedTypes(refreshedTypes);
      setItems(importedItems);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to import material');
    }
  };

  const uploadDocument = async (event, type) => {
    event.preventDefault();

    const form = event.currentTarget;
    try {
      const data = new FormData(form);
      data.append('course', course);
      data.append('subject', subject);
      data.set('category', materialCategory(type));
      await apiClient.post('/learning/files', data);
      form.reset();
      toast.success('Material saved');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to upload document');
    }
  };

  const updateNoteEntry = (id, field, value) => {
    setNoteEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)),
    );
  };

  const uploadNotes = async (event) => {
    event.preventDefault();

    if (noteEntries.some((entry) => !entry.title.trim() || !entry.unitTitle.trim() || !entry.description.trim() || !entry.file)) {
      toast.error('Complete the heading, unit, description, and file for every note');
      return;
    }

    try {
      await Promise.all(
        noteEntries.map((entry) => {
          const data = new FormData();
          data.append('course', course);
          data.append('subject', subject);
          data.append('category', 'notes');
          data.append('title', entry.title.trim());
          data.append('unitTitle', entry.unitTitle.trim());
          data.append('description', entry.description.trim());
          data.append('file', entry.file);
          return apiClient.post('/learning/files', data);
        }),
      );
      setNoteEntries([createNoteEntry()]);
      toast.success(`${noteEntries.length} note(s) saved`);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to upload notes');
    }
  };

  const updateQuestionEntry = (id, field, value) => {
    setQuestionEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)),
    );
  };

  const uploadQuestions = async (event) => {
    event.preventDefault();

    if (questionEntries.some((entry) => !entry.title.trim() || !entry.unitTitle.trim() || !entry.description.trim() || !entry.file)) {
      toast.error('Complete the heading, unit, description, and file for every question');
      return;
    }

    try {
      await Promise.all(
        questionEntries.map((entry) => {
          const data = new FormData();
          data.append('course', course);
          data.append('subject', subject);
          data.append('category', 'generated-questions');
          data.append('title', entry.title.trim());
          data.append('unitTitle', entry.unitTitle.trim());
          data.append('description', entry.description.trim());
          data.append('file', entry.file);
          return apiClient.post('/learning/files', data);
        }),
      );
      setQuestionEntries([createQuestionEntry()]);
      toast.success(`${questionEntries.length} question file(s) saved`);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to upload generated questions');
    }
  };

  const updateQuestionPaperEntry = (id, field, value) => {
    setQuestionPaperEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)),
    );
  };

  const uploadQuestionPapers = async (event) => {
    event.preventDefault();

    if (questionPaperEntries.some((entry) => !entry.title.trim() || !entry.unitTitle.trim() || !entry.description.trim() || !entry.file)) {
      toast.error('Complete the heading, unit, description, and file for every old question paper');
      return;
    }

    try {
      await Promise.all(
        questionPaperEntries.map((entry) => {
          const data = new FormData();
          data.append('course', course);
          data.append('subject', subject);
          data.append('category', 'question-paper');
          data.append('title', entry.title.trim());
          data.append('unitTitle', entry.unitTitle.trim());
          data.append('description', entry.description.trim());
          data.append('file', entry.file);
          return apiClient.post('/learning/files', data);
        }),
      );
      setQuestionPaperEntries([createQuestionPaperEntry()]);
      toast.success(`${questionPaperEntries.length} old question paper(s) saved`);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to upload old question papers');
    }
  };

  const previewMockTest = async (event) => {
    event.preventDefault();
    if (!mockTestFile) return toast.error('Choose an Excel (.xlsx) or CSV file');
    const data = new FormData();
    data.append('course', course);
    data.append('subject', subject);
    data.append('file', mockTestFile);
    setMockTestLoading(true);
    try {
      // A large workbook (for example 50,000 questions) needs time for
      // server-side parsing, validation and preview-row storage. Keep the
      // normal API timeout for other actions, but do not abort this upload.
      const response = await apiClient.post('/learning/questions/preview', data, { timeout: 10 * 60 * 1000 });
      setMockTestPreview(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to validate mock-test file');
    } finally { setMockTestLoading(false); }
  };

  const importMockTest = async () => {
    if (!mockTestPreview || mockTestLoading) return;
    setMockTestLoading(true);
    try {
      const response = await apiClient.post(`/learning/questions/import/${mockTestPreview._id}`, {}, { timeout: 10 * 60 * 1000 });
      toast.success(response.data.message || 'Mock test questions imported');
      setMockTestFile(null);
      setMockTestPreview(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to import mock test');
    } finally {
      setMockTestLoading(false);
    }
  };

  const editItem = async (item) => {
    const value = window.prompt(
      item.materialType === 'syllabus' ? 'Chapter / unit title' : 'File title',
      item.chapter || item.title || '',
    );
    if (!value?.trim()) return;

    try {
      await apiClient.patch(
        item.materialType === 'syllabus'
          ? `/learning/syllabus/${item._id}`
          : `/learning/files/${item._id}`,
        item.materialType === 'syllabus' ? { chapter: value.trim() } : { title: value.trim() },
      );
      toast.success('Content updated');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update content');
    }
  };

  const removeItem = async (item) => {
    const reason = window.prompt('Reason for archiving this content');
    if (!reason?.trim() || !window.confirm('Archive this content?')) return;

    try {
      await apiClient.delete(
        item.materialType === 'syllabus'
          ? `/learning/syllabus/${item._id}`
          : `/learning/files/${item._id}`,
        { data: { reason: reason.trim() } },
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
          <p>Manage syllabus and document learning materials for the selected course and subject.</p>
        </div>
      </div>

      <div className="learning-selectors">
        <label>
          <span>Course</span>
          <select
            value={course}
            onChange={(event) => {
              const nextCourse = event.target.value;
              const nextCourseRecord = courses.find((item) => item._id === nextCourse);
              const subjectBelongsToCourse = nextCourseRecord?.subjects?.some(
                (id) => String(id._id || id) === subject,
              );
              setCourse(nextCourse);
              if (subject && !subjectBelongsToCourse) {
                setSubject('');
              }
            }}
          >
            <option value="">Select course</option>
            {courses.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span>Subject</span>
          <select disabled={!course} value={subject} onChange={(event) => setSubject(event.target.value)}>
            <option value="">Select subject</option>
            {availableSubjects.map((item) => (
              <option key={item._id} value={item._id}>{item.name} · {item.subjectCode}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="learning-material-types">
        <h2>Material type to provide</h2>
        <p>Select the material types you need. Each selected type has its own upload form below.</p>
        <div className="material-options-row">
          {materialOptions.map(([type, label]) => (
            <label className={`material-option--${type}`} key={type}>
              <input checked={selectedTypes.includes(type)} onChange={() => toggleMaterialType(type)} type="checkbox" />
              {label}
            </label>
          ))}
        </div>
      </section>

      {course && subject ? (
        <form className="material-import-panel" onSubmit={importMaterial}>
          <div>
            <h2>Import existing material</h2>
            <p>Copy syllabus, notes, questions, or papers from another course and subject into this selection. Later edits or archive actions here do not change the source course.</p>
          </div>
          <div className="material-import-selectors">
            <select onChange={(event) => { setSourceCourse(event.target.value); setSourceSubject(''); }} required value={sourceCourse}>
              <option value="">Source course</option>
              {courses.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
            <select disabled={!sourceCourse} onChange={(event) => setSourceSubject(event.target.value)} required value={sourceSubject}>
              <option value="">Source subject</option>
              {sourceAvailableSubjects.map((item) => (
                <option key={item._id} value={item._id}>{item.name} · {item.subjectCode}</option>
              ))}
            </select>
          </div>
          {sourceSubject ? (
            <div className="import-type-options">
              {materialOptions.filter(([type]) => sourceMaterialCounts[type]).map(([type, label]) => (
                <label key={type}>
                  <input checked={importTypes.includes(type)} onChange={() => toggleImportType(type)} type="checkbox" />
                  {label} ({sourceMaterialCounts[type]})
                </label>
              ))}
              {!Object.keys(sourceMaterialCounts).length ? <small>No saved material is available for this source.</small> : null}
            </div>
          ) : null}
          <button className="btn btn-primary" disabled={!importTypes.length} type="submit">Import selected material</button>
        </form>
      ) : null}

      {!course || !subject ? (
        <div className="card student-empty">Select a course and subject to manage its content.</div>
      ) : !selectedTypes.length ? (
        <div className="card student-empty">Select at least one material type.</div>
      ) : (
        <div className="learning-layout">
          <aside>
            {selectedTypes.includes('notes') ? (
              <form className="notes-upload-form material-panel material-panel--notes" onSubmit={uploadNotes}>
                <div className="notes-upload-heading">
                  <div>
                    <h3><FiUpload /> Upload unit-wise notes</h3>
                    <p>Add one or many notes. Every note requires all fields.</p>
                  </div>
                  <button className="text-button" onClick={() => setNoteEntries((current) => [...current, createNoteEntry()])} type="button">
                    <FiPlus /> Add another note
                  </button>
                </div>
                {noteEntries.map((entry, index) => (
                  <section className="note-entry" key={entry.id}>
                    <div className="note-entry-title">
                      <strong>Note {savedNoteCount + index + 1}</strong>
                      {noteEntries.length > 1 ? <button className="text-button danger" onClick={() => setNoteEntries((current) => current.filter((item) => item.id !== entry.id))} type="button">Remove</button> : null}
                    </div>
                    <input onChange={(event) => updateNoteEntry(entry.id, 'title', event.target.value)} placeholder="Note heading" required value={entry.title} />
                    <input onChange={(event) => updateNoteEntry(entry.id, 'unitTitle', event.target.value)} placeholder="Unit name or number" required value={entry.unitTitle} />
                    <textarea onChange={(event) => updateNoteEntry(entry.id, 'description', event.target.value)} placeholder="Note description" required value={entry.description} />
                    <input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp" onChange={(event) => updateNoteEntry(entry.id, 'file', event.target.files?.[0] || null)} required type="file" />
                  </section>
                ))}
                <button className="btn btn-primary">Save all notes</button>
              </form>
            ) : null}
            {selectedTypes.includes('generated-questions') ? (
              <form className="questions-upload-form material-panel material-panel--generated-questions" onSubmit={uploadQuestions}>
                <div className="notes-upload-heading">
                  <div>
                    <h3><FiUpload /> Upload generated questions</h3>
                    <p>Add one or many question files. Every question requires all fields.</p>
                  </div>
                  <button className="text-button" onClick={() => setQuestionEntries((current) => [...current, createQuestionEntry()])} type="button">
                    <FiPlus /> Add another question
                  </button>
                </div>
                {questionEntries.map((entry, index) => (
                  <section className="note-entry" key={entry.id}>
                    <div className="note-entry-title">
                      <strong>Question {savedQuestionCount + index + 1}</strong>
                      {questionEntries.length > 1 ? <button className="text-button danger" onClick={() => setQuestionEntries((current) => current.filter((item) => item.id !== entry.id))} type="button">Remove</button> : null}
                    </div>
                    <input onChange={(event) => updateQuestionEntry(entry.id, 'title', event.target.value)} placeholder="Question heading" required value={entry.title} />
                    <input onChange={(event) => updateQuestionEntry(entry.id, 'unitTitle', event.target.value)} placeholder="Unit name or number" required value={entry.unitTitle} />
                    <textarea onChange={(event) => updateQuestionEntry(entry.id, 'description', event.target.value)} placeholder="Question description" required value={entry.description} />
                    <input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp" onChange={(event) => updateQuestionEntry(entry.id, 'file', event.target.files?.[0] || null)} required type="file" />
                  </section>
                ))}
                <button className="btn btn-primary">Save all generated questions</button>
              </form>
            ) : null}
            {selectedTypes.includes('question-paper') ? (
              <form className="question-papers-upload-form material-panel material-panel--question-paper" onSubmit={uploadQuestionPapers}>
                <div className="notes-upload-heading">
                  <div>
                    <h3><FiUpload /> Upload old question paper</h3>
                    <p>Add one or many old question papers. Every paper requires all fields.</p>
                  </div>
                  <button className="text-button" onClick={() => setQuestionPaperEntries((current) => [...current, createQuestionPaperEntry()])} type="button">
                    <FiPlus /> Add another old question paper
                  </button>
                </div>
                {questionPaperEntries.map((entry, index) => (
                  <section className="note-entry" key={entry.id}>
                    <div className="note-entry-title">
                      <strong>Old question paper {savedQuestionPaperCount + index + 1}</strong>
                      {questionPaperEntries.length > 1 ? <button className="text-button danger" onClick={() => setQuestionPaperEntries((current) => current.filter((item) => item.id !== entry.id))} type="button">Remove</button> : null}
                    </div>
                    <input onChange={(event) => updateQuestionPaperEntry(entry.id, 'title', event.target.value)} placeholder="Old question paper heading" required value={entry.title} />
                    <input onChange={(event) => updateQuestionPaperEntry(entry.id, 'unitTitle', event.target.value)} placeholder="Unit name or number" required value={entry.unitTitle} />
                    <textarea onChange={(event) => updateQuestionPaperEntry(entry.id, 'description', event.target.value)} placeholder="Old question paper description" required value={entry.description} />
                    <input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp" onChange={(event) => updateQuestionPaperEntry(entry.id, 'file', event.target.files?.[0] || null)} required type="file" />
                  </section>
                ))}
                <button className="btn btn-primary">Save all old question papers</button>
              </form>
            ) : null}
            {selectedTypes.includes('mock-test') ? (
              <form className="material-panel material-panel--mock-test" onSubmit={previewMockTest}>
                <h3><FiUpload /> Upload Mock Test Excel</h3>
                <p>Upload .xlsx or .csv questions. The Subject column is used to assign each question to a subject in this course.</p>
                <input key={mockTestPreview ? 'imported' : 'choose'} onChange={(event) => { setMockTestFile(event.target.files?.[0] || null); setMockTestPreview(null); }} type="file" />
                <small>{mockTestFile?.name || 'Choose the Excel file from your Mac.'}</small>
                {mockTestLoading ? <small>Large workbooks can take several minutes. Please keep this page open.</small> : null}
                {!mockTestPreview ? <button className="btn btn-primary" disabled={mockTestLoading}>{mockTestLoading ? 'Validating…' : 'Validate Mock Test'}</button> : <div className="mock-test-preview"><b>{mockTestPreview.validRows} valid · {mockTestPreview.invalidRows} rejected</b>{mockTestPreview.invalidRows ? <ul>{mockTestPreview.rows.filter((row) => !row.valid).slice(0, 5).map((row) => <li key={row.rowNumber}>Row {row.rowNumber}: {row.validationErrors.join(', ')}</li>)}</ul> : null}<button className="btn btn-primary" disabled={mockTestLoading} onClick={importMockTest} type="button">{mockTestLoading ? 'Importing questions…' : 'Import valid questions'}</button></div>}
              </form>
            ) : null}
            {documentTypes.map((type) => {
              if (type === 'notes' || type === 'generated-questions' || type === 'question-paper' || type === 'mock-test') return null;
              const label = materialOptions.find(([key]) => key === type)?.[1] || type;
              return (
                <form className={`material-panel material-panel--${type}`} key={type} onSubmit={(event) => uploadDocument(event, type)}>
                  <h3><FiUpload /> Upload {label}</h3>
                  <input name="title" placeholder={`${label} document title`} required />
                  <textarea name="description" placeholder={`${label} description`} />
                  {type === 'other' ? (
                    <input name="customType" placeholder="Type of material" required />
                  ) : null}
                  <input
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
                    name="file"
                    required
                    type="file"
                  />
                  <small>PDF, DOC, DOCX, JPG, PNG, and WEBP files are supported.</small>
                  <button className="btn btn-primary">Save {label}</button>
                </form>
              );
            })}
          </aside>

          <main>
            {loading ? <div className="card student-empty">Loading content…</div> : items.length ? (
              <div className="learning-item-list">
                {items.map((item, index) => (
                  <article className={`learning-item--${item.materialType}`} key={`${item.materialType}-${item._id}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <small className="material-type-label">
                        {item.materialType.replaceAll('-', ' ')}
                        {item.customType ? ` · ${item.customType}` : ''}
                        {item.unitTitle ? ` · Unit: ${item.unitTitle}` : ''}
                      </small>
                      <h3>{item.chapter || item.title}</h3>
                      <p>{item.topic || item.description || 'No description added'}</p>
                      <small className="uploaded-file-name">File: {item.originalFilename || 'Uploaded document'}</small>
                    </div>
                    {item.previewUrl ? <img alt={`Preview of ${item.originalFilename}`} className="learning-file-preview" src={resolveAssetUrl(item.previewUrl)} /> : null}
                    {item.downloadUrl ? <a href={resolveAssetUrl(item.downloadUrl)} rel="noreferrer" target="_blank"><FiFile /> Open</a> : null}
                    <div className="learning-row-actions">
                      <button aria-label="Edit content" onClick={() => editItem(item)} type="button"><FiEdit2 /></button>
                      <button aria-label="Archive content" className="danger" onClick={() => removeItem(item)} type="button"><FiTrash2 /></button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <div className="card student-empty">No selected material has been added for this subject yet.</div>}
          </main>
        </div>
      )}
    </section>
  );
}
