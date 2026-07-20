import { useEffect, useState } from 'react';
import { FiEdit2, FiPlus, FiSearch, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';

const empty = {
  name: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  joiningDate: '',
  experience: '',
  qualification: '',
  address: '',
  biography: '',
  assignedSubjects: [],
  subjectDescription: '',
  isActive: true,
};
const yearsOld = (value) =>
  value ? Math.max(0, new Date().getFullYear() - new Date(value).getFullYear()) : '—';

export function Teachers() {
  const [items, setItems] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [credential, setCredential] = useState(null);
  const load = async () => {
    try {
      const [teachers, subjectResponse] = await Promise.all([
        apiClient.get('/teachers', { params: { limit: 100, search } }),
        apiClient.get('/subjects', { params: { limit: 100, status: 'active' } }),
      ]);
      setItems(teachers.data.data || []);
      setSubjects(subjectResponse.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load teachers');
    }
  };
  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [search]);
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      ...empty,
      name: item.name,
      email: item.email,
      phone: item.profile?.mobile || item.profile?.phone || '',
      dateOfBirth: item.profile?.dateOfBirth?.slice?.(0, 10) || '',
      joiningDate: item.profile?.joiningDate?.slice?.(0, 10) || '',
      experience: item.profile?.experience || '',
      qualification: item.profile?.qualification || '',
      address: item.profile?.address || '',
      biography: item.profile?.biography || '',
      assignedSubjects: (item.profile?.assignedSubjects || []).map(
        (subject) => subject._id || subject
      ),
      subjectDescription: item.profile?.subjectDescriptions?.[0]?.description || '',
      isActive: item.isActive,
    });
  };
  const toggleSubject = (id) =>
    setForm((current) => ({
      ...current,
      assignedSubjects: current.assignedSubjects.includes(id)
        ? current.assignedSubjects.filter((item) => item !== id)
        : [...current.assignedSubjects, id],
    }));
  const save = async (event) => {
    event.preventDefault();
    if (!form.assignedSubjects.length) return toast.error('Assign at least one active subject');
    setSaving(true);
    const payload = {
      name: form.name,
      ...(editing ? {} : { email: form.email, role: 'teacher' }),
      isActive: form.isActive,
      profile: {
        phone: form.phone,
        mobile: form.phone,
        dateOfBirth: form.dateOfBirth || undefined,
        joiningDate: form.joiningDate || undefined,
        experience: form.experience,
        qualification: form.qualification,
        address: form.address,
        biography: form.biography,
        assignedSubjects: form.assignedSubjects,
        subjects: form.assignedSubjects,
        subjectDescriptions: form.assignedSubjects.map((subject) => ({
          subject,
          description: form.subjectDescription,
        })),
      },
    };
    try {
      if (editing) await apiClient.patch(`/teachers/${editing._id}`, payload);
      else {
        const response = await apiClient.post('/teachers', payload);
        if (response.data.data?.temporaryPassword) setCredential(response.data.data);
      }
      toast.success(`Teacher ${editing ? 'updated' : 'added'}`);
      setForm(null);
      setEditing(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save teacher');
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="faculty-management page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">FACULTY MANAGEMENT</p>
          <h1>Teachers</h1>
          <p>Add faculty, assign active subjects, and prevent duplicate email or mobile records.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setForm(empty);
          }}
        >
          <FiPlus /> Add teacher
        </button>
      </div>
      <label className="teacher-search">
        <FiSearch />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search teacher name or email"
        />
      </label>
      <div className="teacher-grid">
        {items.map((item) => (
          <article className="teacher-card" key={item._id}>
            <div>
              <span className="teacher-initial">{item.name.slice(0, 1)}</span>
              <span className={`status-pill ${item.isActive ? 'active' : 'cancelled'}`}>
                {item.isActive ? 'active' : 'inactive'}
              </span>
            </div>
            <h3>{item.name}</h3>
            <p>{item.profile?.qualification || 'Qualification not added'}</p>
            <dl>
              <div>
                <dt>Age</dt>
                <dd>{item.profile?.age || yearsOld(item.profile?.dateOfBirth)}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>
                  {item.profile?.joiningDate
                    ? new Date(item.profile.joiningDate).toLocaleDateString('en-IN')
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{item.profile?.experience || '—'}</dd>
              </div>
            </dl>
            <div className="teacher-subjects">
              {(item.profile?.assignedSubjects || []).map((subject) => (
                <span key={subject._id || subject}>
                  {subject.name || subject.subjectCode || 'Subject'}
                </span>
              ))}
            </div>
            <p>
              {item.profile?.mobile || item.profile?.phone} · {item.email}
            </p>
            <button className="text-button" onClick={() => openEdit(item)}>
              <FiEdit2 /> Edit teacher
            </button>
          </article>
        ))}
      </div>
      {form && (
        <div className="login-overlay">
          <form className="student-form teacher-form" onSubmit={save}>
            <button type="button" className="modal-close" onClick={() => setForm(null)}>
              <FiX />
            </button>
            <h2>{editing ? 'Update' : 'Add'} teacher</h2>
            <div className="student-fields">
              <label>
                <span>Full name</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Email {editing && '(read-only)'}</span>
                <input
                  required
                  type="email"
                  readOnly={Boolean(editing)}
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Mobile number</span>
                <input
                  required
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Date of birth</span>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, dateOfBirth: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Joining date</span>
                <input
                  required
                  type="date"
                  value={form.joiningDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, joiningDate: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Experience (years/months)</span>
                <input
                  value={form.experience}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, experience: event.target.value }))
                  }
                  placeholder="e.g. 4 years 6 months"
                />
              </label>
              <label>
                <span>Qualification</span>
                <input
                  value={form.qualification}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, qualification: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Address</span>
                <input
                  value={form.address}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, address: event.target.value }))
                  }
                />
              </label>
              <label className="full-field">
                <span>Biography</span>
                <textarea
                  value={form.biography}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, biography: event.target.value }))
                  }
                />
              </label>
              <fieldset className="full-field subject-picker">
                <legend>Assigned subjects</legend>
                {subjects.map((subject) => (
                  <label key={subject._id}>
                    <input
                      type="checkbox"
                      checked={form.assignedSubjects.includes(subject._id)}
                      onChange={() => toggleSubject(subject._id)}
                    />
                    <span>
                      <b>{subject.name}</b>
                      <small>{subject.description || subject.subjectCode}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="full-field">
                <span>Subject-specific description</span>
                <textarea
                  value={form.subjectDescription}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subjectDescription: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Status</span>
                <select
                  value={String(form.isActive)}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.value === 'true' }))
                  }
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
            </div>
            <button disabled={saving} className="btn btn-primary modal-submit">
              {saving ? 'Saving…' : 'Save teacher'}
            </button>
          </form>
        </div>
      )}
      {credential && (
        <div className="login-overlay">
          <article className="student-detail-panel credential-panel">
            <button className="modal-close" onClick={() => setCredential(null)}>
              <FiX />
            </button>
            <h2>One-time teacher credentials</h2>
            <p>
              Copy this password now. It is not stored or shown again, and the teacher must replace
              it after login.
            </p>
            <dl>
              <div><dt>Email</dt><dd>{credential.teacher?.email}</dd></div>
              <div><dt>Temporary password</dt><dd className="temporary-password">{credential.temporaryPassword}</dd></div>
            </dl>
          </article>
        </div>
      )}
    </section>
  );
}
