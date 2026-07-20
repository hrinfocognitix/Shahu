import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiEye, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';
import { environment } from '../../config/environment';

const labels = {
  courses: 'Courses',
  'payment-accounts': 'Payment Accounts',
  'course-purchases': 'Course Purchases',
  syllabus: 'Syllabus',
  notes: 'Notes',
  'question-papers': 'Question Papers',
  materials: 'Study Materials',
  videos: 'Video Lectures',
};

const plainResources = new Set([
  'syllabus',
  'notes',
  'question-papers',
  'materials',
  'videos',
  'assignments',
  'exams',
  'results',
  'marks',
  'attendance',
  'calendar',
  'announcements',
  'gallery',
  'achievements',
  'subjects',
  'students',
  'teachers',
]);

const initialCourse = {
  name: '',
  description: '',
  fees: '',
  durationDays: '',
  actualPrice: '',
  discountType: 'percentage',
  discountValue: '',
  discountPercent: '',
  offerText: '',
  primaryPaymentAccount: '',
  status: 'active',
  imageUrl: '',
  imageFile: null,
  benefitsText: '',
  useCasesText: '',
  highlightsText: '',
  detailSections: [],
  subjects: [],
  subjectDetails: [],
};
const initialAccount = {
  title: '',
  description: '',
  accountName: '',
  qrCode: '',
  mobileNo: '',
  upiId: '',
  accountNo: '',
  ifsc: '',
  accountType: 'upi',
  bankName: '',
  gatewayName: '',
  merchantId: '',
  defaultAccount: false,
  status: 'active',
};
const initialRecord = { title: '', description: '', course: '', status: 'active', resourceUrl: '' };
const initialAchievement = {
  title: '',
  description: '',
  status: 'published',
  resourceUrl: '',
  media: [],
  wallpaperFiles: [],
  videoFile: null,
};

const splitLines = (value) =>
  String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
const joinLines = (value) => (value || []).join('\n');
const titleFor = (resource) =>
  labels[resource] ||
  resource.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const resolveAssetUrl = (path) => {
  const assetBase = environment.apiBaseUrl.replace(/\/api\/v1$/, '');
  if (!path) return '';
  if (!path.startsWith('http')) return `${assetBase}${path}`;
  return path.replace(/^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2):5001/i, assetBase);
};

export function Management({ resource }) {
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [activeSubjects, setActiveSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialRecord);

  const isCourse = resource === 'courses';
  const isAccount = resource === 'payment-accounts';
  const isPurchases = resource === 'course-purchases';
  const canUseGeneric = plainResources.has(resource);

  const load = async () => {
    setLoading(true);
    try {
      const requests = [apiClient.get(`/${resource}`, { params: { limit: 100 } })];
      if (!isCourse && !isPurchases)
        requests.push(apiClient.get('/courses', { params: { limit: 100 } }));
      const [response, courseResponse] = await Promise.all(requests);
      setItems(response.data.data || []);
      if (courseResponse) setCourses(courseResponse.data.data || []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || `Unable to load ${titleFor(resource).toLowerCase()}`
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [resource]);
  useEffect(() => {
    if (isCourse)
      apiClient
        .get('/payment-accounts', { params: { limit: 100 } })
        .then((response) =>
          setPaymentAccounts(
            (response.data.data || []).filter((item) => item.status !== 'inactive')
          )
        )
        .catch(() => setPaymentAccounts([]));
  }, [isCourse]);
  useEffect(() => {
    if (isCourse)
      apiClient
        .get('/subjects', { params: { limit: 100, status: 'active' } })
        .then((response) => setActiveSubjects(response.data.data || []))
        .catch(() => setActiveSubjects([]));
  }, [isCourse]);

  const beginCreate = () => {
    setEditing(null);
    setForm(
      isCourse
        ? initialCourse
        : isAccount
          ? initialAccount
          : resource === 'achievements'
            ? initialAchievement
            : initialRecord
    );
    setOpen(true);
  };

  const beginEdit = (item) => {
    setEditing(item);
    if (isCourse) {
      setForm({
        ...initialCourse,
        ...item,
        fees: item.fees ?? '',
        durationDays: item.durationDays ?? '',
        actualPrice: item.actualPrice || item.price || item.fees || '',
        discountType: item.discountType || 'percentage',
        discountValue: item.discountValue ?? item.discountPercent ?? '',
        benefitsText: joinLines(item.benefits),
        useCasesText: joinLines(item.useCases),
        highlightsText: joinLines(item.highlights),
        detailSections: item.detailSections || [],
        subjectDetails: item.subjectDetails || [],
      });
    } else if (isAccount) {
      setForm({
        ...initialAccount,
        title: item.title || '',
        description: item.description || '',
        status: item.status || 'active',
        ...(item.payload || {}),
      });
    } else
      setForm({
        ...initialRecord,
        title: item.title || item.name || '',
        description: item.description || '',
        course: item.course?._id || item.course || '',
        status: item.status || 'active',
        resourceUrl: item.resourceUrl || '',
        media: item.media || [],
      });
    setOpen(true);
  };

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const addSection = () =>
    update('detailSections', [
      ...form.detailSections,
      { title: '', description: '', items: [{ label: '', type: 'notes', value: '' }] },
    ]);
  const changeSection = (index, key, value) =>
    update(
      'detailSections',
      form.detailSections.map((section, current) =>
        current === index ? { ...section, [key]: value } : section
      )
    );
  const changeItem = (sectionIndex, itemIndex, key, value) =>
    update(
      'detailSections',
      form.detailSections.map((section, current) =>
        current !== sectionIndex
          ? section
          : {
              ...section,
              items: section.items.map((item, itemCurrent) =>
                itemCurrent === itemIndex ? { ...item, [key]: value } : item
              ),
            }
      )
    );

  const save = async (event) => {
    event.preventDefault();
    try {
      let payload;
      if (isCourse) {
        let imageUrl = form.imageUrl;
        if (form.imageFile) {
          const uploadData = new FormData();
          uploadData.append('file', form.imageFile);
          const upload = await apiClient.post('/upload', uploadData);
          imageUrl = upload.data.data.url;
        }
        payload = {
          ...form,
          imageUrl,
          durationDays: Number(form.durationDays || 0),
          actualPrice: Number(form.actualPrice || 0),
          discountType: form.discountType || 'percentage',
          discountValue: Number(form.discountValue || 0),
          offerText: String(form.offerText || '').trim(),
          benefits: splitLines(form.benefitsText),
          useCases: splitLines(form.useCasesText),
          highlights: splitLines(form.highlightsText),
          updateReason: editing ? 'Course details updated from admin panel' : undefined,
        };
        delete payload.imageFile;
        delete payload.benefitsText;
        delete payload.useCasesText;
        delete payload.highlightsText;
        delete payload.actionHistory;
        delete payload.createdBy;
        delete payload.updatedBy;
        delete payload.createdAt;
        delete payload.updatedAt;
        delete payload.__v;
        delete payload._id;
      } else if (isAccount)
        payload = {
          title: form.title,
          description: form.description,
          payload: {
            accountName: form.accountName,
            qrCode: form.qrCode,
            mobileNo: form.mobileNo,
            upiId: form.upiId,
            accountNo: form.accountNo,
            ifsc: form.ifsc,
            accountType: form.accountType,
            bankName: form.bankName,
            gatewayName: form.gatewayName,
            merchantId: form.merchantId,
            defaultAccount: Boolean(form.defaultAccount),
          },
          status: form.status,
        };
      else {
        let resourceUrl = form.resourceUrl;
        if (resource === 'achievements') {
          const selectedFiles = [
            ...(form.wallpaperFiles || []),
            ...(form.videoFile ? [form.videoFile] : []),
          ];
          const uploadedMedia = await Promise.all(
            selectedFiles.map(async (file) => {
              const uploadData = new FormData();
              uploadData.append('file', file);
              const upload = await apiClient.post('/upload', uploadData);
              return {
                url: upload.data.data.url,
                type: file.type.startsWith('video/') ? 'video' : 'image',
              };
            })
          );
          const existingMedia = form.media || [];
          const urlMedia =
            !existingMedia.length && form.resourceUrl
              ? [{ url: form.resourceUrl, type: 'image' }]
              : [];
          const media = [...existingMedia, ...urlMedia, ...uploadedMedia];
          if (!media.length) {
            toast.error('Select at least one achievement image or video');
            return;
          }
          resourceUrl = media.find((item) => item.type === 'image')?.url || media[0]?.url;
          payload = {
            title: form.title,
            description: form.description,
            status: 'published',
            resourceUrl,
            imageUrl: media.find((item) => item.type === 'image')?.url,
            videoUrl: media.find((item) => item.type === 'video')?.url,
            media,
          };
        } else {
          payload = { ...form, resourceUrl };
        }
      }
      if (editing) await apiClient.patch(`/${resource}/${editing._id}`, payload);
      else await apiClient.post(`/${resource}`, payload);
      toast.success(`${titleFor(resource).replace(/s$/, '')} ${editing ? 'updated' : 'created'}`);
      setOpen(false);
      load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || 'Unable to upload and save achievement'
      );
    }
  };

  const remove = async (item) => {
    const reason = isCourse
      ? window.prompt('Why are you deleting this course?')
      : 'Deleted from admin panel';
    if (reason === null || !window.confirm(`Delete ${item.name || item.title}?`)) return;
    try {
      await apiClient.delete(`/${resource}/${item._id}`, {
        params: isCourse ? { deleteReason: reason } : {},
      });
      toast.success('Deleted');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete record');
    }
  };

  const purchaseSummary = useMemo(
    () =>
      items.reduce((summary, item) => {
        const key = item.course?.name || item.payload?.courseName || 'Unknown course';
        summary[key] = (summary[key] || 0) + 1;
        return summary;
      }, {}),
    [items]
  );

  return (
    <section className="management-page page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Academy management</p>
          <h1>{titleFor(resource)}</h1>
          <p>
            {resource === 'students'
              ? 'Students are created automatically after a verified Android course purchase.'
              : 'Manage live records used by the website and student app.'}
          </p>
        </div>
        {!isPurchases && resource !== 'students' && (
          <button className="btn btn-primary" onClick={beginCreate}>
            <FiPlus /> Add {titleFor(resource).replace(/s$/, '')}
          </button>
        )}
      </div>
      {isPurchases && (
        <div className="purchase-summary">
          {Object.entries(purchaseSummary).map(([course, count]) => (
            <span key={course}>
              <b>{count}</b> {course}
            </span>
          ))}
        </div>
      )}
      <div className="card management-list">
        {loading ? (
          <p className="muted">Loading records…</p>
        ) : !items.length ? (
          <p className="muted">No {titleFor(resource).toLowerCase()} found yet.</p>
        ) : (
          items.map((item) => (
            <article className="resource-row" key={item._id}>
              {resource === 'achievements' && item.resourceUrl ? (
                <img
                  className="achievement-thumbnail"
                  src={resolveAssetUrl(item.resourceUrl)}
                  alt={item.title}
                />
              ) : (
                <span className="resource-mark">
                  {(item.name || item.title || 'R').slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <strong>{item.name || item.title || item.payload?.studentName}</strong>
                <p>
                  {isPurchases
                    ? `${item.payload?.studentName} · ${item.payload?.mobileNo} · ${item.payload?.transactionId}`
                    : item.description ||
                      item.payload?.upiId ||
                      item.payload?.mobileNo ||
                      'No description added'}
                </p>
                {resource === 'achievements' ? (
                  <small>
                    {item.media?.length || 1} media item{item.media?.length === 1 ? '' : 's'} ·
                    Uploaded{' '}
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : 'recently'}
                  </small>
                ) : null}
                {isPurchases && (
                  <small>
                    Course: {item.course?.name || item.payload?.courseName} · Rs.{' '}
                    {item.payload?.amount || 0} · Valid till{' '}
                    {item.payload?.validity?.endDate
                      ? new Date(item.payload.validity.endDate).toLocaleDateString('en-IN')
                      : 'not set'}
                  </small>
                )}
              </div>
              <span className="status-pill">{item.status || 'active'}</span>
              {!isPurchases && (
                <div className="row-actions">
                  <button className="text-button" onClick={() => beginEdit(item)}>
                    <FiEdit2 /> Edit
                  </button>
                  <button className="text-button danger" onClick={() => remove(item)}>
                    <FiTrash2 /> Delete
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
      {open && (
        <div className="login-overlay" onMouseDown={() => setOpen(false)}>
          <form
            className="student-form management-form"
            onSubmit={save}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setOpen(false)}>
              <FiX />
            </button>
            <h2>
              {editing ? 'Update' : 'Add'} {titleFor(resource).replace(/s$/, '')}
            </h2>
            {isCourse ? (
              <CourseFields
                form={form}
                update={update}
                addSection={addSection}
                changeSection={changeSection}
                changeItem={changeItem}
                paymentAccounts={paymentAccounts}
                activeSubjects={activeSubjects}
              />
            ) : isAccount ? (
              <AccountFields form={form} update={update} />
            ) : canUseGeneric ? (
              <RecordFields form={form} update={update} courses={courses} resource={resource} />
            ) : null}
            <button className="btn btn-primary modal-submit" type="submit">
              {editing ? 'Save changes' : 'Create record'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function CourseFields({ form, update, addSection, changeSection, changeItem, paymentAccounts, activeSubjects }) {
  const original = Number(form.actualPrice || 0);
  const discount = Number(form.discountValue || 0);
  const payable = Math.max(
    0,
    Math.round(
      form.discountType === 'fixed' ? original - discount : original - (original * discount) / 100
    )
  );
  const selectedSubjectIds = (form.subjects || []).map((item) => item._id || item);
  const subjectDetail = (subjectId) =>
    (form.subjectDetails || []).find(
      (detail) => String(detail.subject?._id || detail.subject) === String(subjectId)
    ) || { subject: subjectId, description: '', displayOrder: selectedSubjectIds.indexOf(subjectId), sections: [] };
  const updateSubjectDetail = (subjectId, changes) => {
    const next = selectedSubjectIds.map((id, index) => {
      const current = subjectDetail(id);
      return String(id) === String(subjectId)
        ? { ...current, ...changes, subject: id }
        : { ...current, subject: id, displayOrder: current.displayOrder ?? index };
    });
    update('subjectDetails', next);
  };
  return (
    <div className="student-fields">
      <Field label="Course name" value={form.name} onChange={(value) => update('name', value)} />
      <Field
        label="Validity (days)"
        type="number"
        value={form.durationDays}
        onChange={(value) => update('durationDays', value)}
      />
      <div className="course-offer-fields">
        <Field
          label="Original price (INR)"
          type="number"
          value={form.actualPrice}
          onChange={(value) => update('actualPrice', value)}
        />
        <label>
          <span>Discount type</span>
          <select
            value={form.discountType || 'percentage'}
            onChange={(event) => update('discountType', event.target.value)}
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed amount (INR)</option>
          </select>
        </label>
        <Field
          label={
            form.discountType === 'fixed' ? 'Discount amount (INR)' : 'Discount percentage (%)'
          }
          type="number"
          value={form.discountValue}
          onChange={(value) => update('discountValue', value)}
          required={false}
        />
        <label>
          <span>Payable price (calculated)</span>
          <input value={`₹${payable.toLocaleString('en-IN')}`} readOnly />
        </label>
        <Field
          label="Admin offer highlight"
          value={form.offerText}
          onChange={(value) => update('offerText', value)}
          required={false}
        />
        <small>
          The server recalculates and validates the payable price. Example message: Limited-time
          admission offer.
        </small>
      </div>
      <label>
        <span>Primary payment account</span>
        <select
          value={form.primaryPaymentAccount || ''}
          onChange={(event) => update('primaryPaymentAccount', event.target.value)}
        >
          <option value="">Use academy default account</option>
          {paymentAccounts.map((account) => (
            <option value={account._id} key={account._id}>
              {account.title}
            </option>
          ))}
        </select>
        <small>This is the account shown to Android buyers for this course.</small>
      </label>
      <fieldset className="full-field subject-picker">
        <legend>Course subjects</legend>
        {activeSubjects.map((subject) => {
          const selectedSubjects = selectedSubjectIds;
          return (
            <label key={subject._id}>
              <input
                type="checkbox"
                checked={selectedSubjects.includes(subject._id)}
                onChange={() => {
                  const nextSubjects = selectedSubjects.includes(subject._id)
                    ? selectedSubjects.filter((id) => id !== subject._id)
                    : [...new Set([...selectedSubjects, subject._id])];
                  update('subjects', nextSubjects);
                  update(
                    'subjectDetails',
                    nextSubjects.map((id, index) => ({
                      ...subjectDetail(id),
                      subject: id,
                      displayOrder: subjectDetail(id).displayOrder ?? index,
                    }))
                  );
                }}
              />
              <span><b>{subject.name}</b><small>{subject.description || subject.subjectCode}</small></span>
            </label>
          );
        })}
      </fieldset>
      {!!selectedSubjectIds.length && <div className="full-field course-subject-details">
        <strong>Subject descriptions and sections</strong>
        <small>Sections are displayed in the entered order on the website and student app.</small>
        {selectedSubjectIds.map((subjectId, index) => {
          const subject = activeSubjects.find((item) => item._id === subjectId);
          const detail = subjectDetail(subjectId);
          return <article key={subjectId}>
            <h3>{subject?.name || `Subject ${index + 1}`}</h3>
            <textarea value={detail.description || ''} placeholder="Subject description" onChange={(event) => updateSubjectDetail(subjectId, { description: event.target.value })} />
            <input type="number" min="0" value={detail.displayOrder ?? index} aria-label={`${subject?.name || 'Subject'} display order`} onChange={(event) => updateSubjectDetail(subjectId, { displayOrder: Number(event.target.value || 0) })} />
            <textarea value={(detail.sections || []).map((section) => section.title).join('\n')} placeholder="Sections, one per line" onChange={(event) => updateSubjectDetail(subjectId, { sections: splitLines(event.target.value).map((title, sectionIndex) => ({ title, displayOrder: sectionIndex })) })} />
          </article>;
        })}
      </div>}
      <CourseImagePreview form={form} />
      <label>
        <span>Upload course image</span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => update('imageFile', event.target.files?.[0] || null)}
        />
        <small>The selected image will replace the saved course image on website and app.</small>
      </label>
      <Field
        label="Image URL (optional)"
        value={form.imageUrl}
        onChange={(value) => update('imageUrl', value)}
        required={false}
      />
      <Field
        label="Description"
        as="textarea"
        value={form.description}
        onChange={(value) => update('description', value)}
      />
      <Field
        label="Benefits (one per line)"
        as="textarea"
        value={form.benefitsText}
        onChange={(value) => update('benefitsText', value)}
        required={false}
      />
      <Field
        label="Where this course helps (one per line)"
        as="textarea"
        value={form.useCasesText}
        onChange={(value) => update('useCasesText', value)}
        required={false}
      />
      <Field
        label="Highlights (one per line)"
        as="textarea"
        value={form.highlightsText}
        onChange={(value) => update('highlightsText', value)}
        required={false}
      />
      <div className="detail-builder">
        <div>
          <strong>Syllabus and resources</strong>
          <button type="button" className="text-button" onClick={addSection}>
            <FiPlus /> Add section
          </button>
        </div>
        {form.detailSections.map((section, sectionIndex) => (
          <div className="detail-builder-section" key={sectionIndex}>
            <input
              placeholder="Section title"
              value={section.title}
              onChange={(event) => changeSection(sectionIndex, 'title', event.target.value)}
            />
            <textarea
              placeholder="Section description"
              value={section.description}
              onChange={(event) => changeSection(sectionIndex, 'description', event.target.value)}
            />
            {section.items.map((item, itemIndex) => (
              <div className="detail-builder-item" key={itemIndex}>
                <input
                  placeholder="Resource label"
                  value={item.label}
                  onChange={(event) =>
                    changeItem(sectionIndex, itemIndex, 'label', event.target.value)
                  }
                />
                <select
                  value={item.type}
                  onChange={(event) =>
                    changeItem(sectionIndex, itemIndex, 'type', event.target.value)
                  }
                >
                  <option value="notes">Notes</option>
                  <option value="question-paper">Question paper</option>
                  <option value="question-list">Question list</option>
                  <option value="link">Link</option>
                  <option value="document">Document</option>
                  <option value="other">Other</option>
                </select>
                <input
                  placeholder="Resource details or URL"
                  value={item.value}
                  onChange={(event) =>
                    changeItem(sectionIndex, itemIndex, 'value', event.target.value)
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                changeSection(sectionIndex, 'items', [
                  ...section.items,
                  { label: '', type: 'other', value: '' },
                ])
              }
            >
              <FiPlus /> Add resource
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CourseImagePreview({ form }) {
  const selectedUrl = useMemo(
    () => (form.imageFile ? URL.createObjectURL(form.imageFile) : ''),
    [form.imageFile]
  );
  useEffect(
    () => () => {
      if (selectedUrl) URL.revokeObjectURL(selectedUrl);
    },
    [selectedUrl]
  );
  const previewUrl = selectedUrl || resolveAssetUrl(form.imageUrl);
  if (!previewUrl)
    return (
      <div className="achievement-preview-empty">The course image preview will appear here.</div>
    );
  return (
    <div className="course-image-preview">
      <strong>Course image preview</strong>
      <img src={previewUrl} alt={`${form.name || 'Course'} preview`} />
      <small>
        {selectedUrl
          ? 'New image selected — save changes to publish it.'
          : 'Currently displayed on the website and app.'}
      </small>
    </div>
  );
}
function AccountFields({ form, update }) {
  return (
    <div className="student-fields">
      <p className="muted">
        These live payment details appear in the mobile purchase screen. Direct GPay/PhonePe payment
        requires the complete UPI ID, including its @ handle. A mobile number alone is displayed for
        reference but cannot create a UPI payment link.
      </p>
      <Field
        label="Payment account display name"
        value={form.title}
        onChange={(value) => update('title', value)}
      />
      <label><span>Account type</span><select value={form.accountType} onChange={(event) => update('accountType', event.target.value)}><option value="upi">UPI</option><option value="bank">Bank account</option><option value="gateway">Payment gateway</option><option value="qr">QR code</option></select></label>
      <Field label="Bank name" value={form.bankName} onChange={(value) => update('bankName', value)} required={false} />
      <Field
        label="Account holder / UPI recipient name"
        value={form.accountName}
        onChange={(value) => update('accountName', value)}
      />
      <Field
        label="GPay / PhonePe registered mobile number"
        value={form.mobileNo}
        onChange={(value) => update('mobileNo', value)}
        required={false}
      />
      <Field
        label="Complete UPI ID for Pay Now (example: name@okaxis)"
        value={form.upiId}
        onChange={(value) => update('upiId', value)}
        required={false}
      />
      <Field
        label="Bank account number"
        value={form.accountNo}
        onChange={(value) => update('accountNo', value)}
        required={false}
      />
      <Field
        label="IFSC code"
        value={form.ifsc}
        onChange={(value) => update('ifsc', value)}
        required={false}
      />
      <Field
        label="QR code image URL"
        value={form.qrCode}
        onChange={(value) => update('qrCode', value)}
        required={false}
      />
      <Field label="Gateway name" value={form.gatewayName} onChange={(value) => update('gatewayName', value)} required={false} />
      <Field label="Merchant ID" value={form.merchantId} onChange={(value) => update('merchantId', value)} required={false} />
      <label><span>Account status</span><select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <label className="remember"><input type="checkbox" checked={Boolean(form.defaultAccount)} onChange={(event) => update('defaultAccount', event.target.checked)} /><span>Use as academy default account</span></label>
      <Field
        label="Payment instructions shown to buyers"
        as="textarea"
        value={form.description}
        onChange={(value) => update('description', value)}
        required={false}
      />
    </div>
  );
}
function RecordFields({ form, update, courses, resource }) {
  const isAchievement = resource === 'achievements';
  return (
    <div className="student-fields">
      <Field
        label={isAchievement ? 'Achievement title' : 'Title'}
        value={form.title}
        onChange={(value) => update('title', value)}
      />
      {!isAchievement ? (
        <label>
          <span>Course</span>
          <select value={form.course} onChange={(event) => update('course', event.target.value)}>
            <option value="">Select course</option>
            {courses.map((course) => (
              <option value={course._id} key={course._id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Field
        label={isAchievement ? 'Achievement description' : 'Description'}
        as="textarea"
        value={form.description}
        onChange={(value) => update('description', value)}
        required={false}
      />
      {isAchievement ? (
        <>
          <AchievementMediaPreview form={form} />
          <label>
            <span>Add achievement images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => update('wallpaperFiles', Array.from(event.target.files || []))}
            />
            <small>
              Select one or multiple images. Existing media remains attached when updating.
            </small>
          </label>
          <label>
            <span>Add achievement video (optional)</span>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
              onChange={(event) => update('videoFile', event.target.files?.[0] || null)}
            />
            <small>MP4, WebM, MOV and M4V videos are supported on the website and app.</small>
          </label>
        </>
      ) : null}
      <Field
        label={isAchievement ? 'Image URL (optional)' : 'Resource link / URL'}
        value={form.resourceUrl}
        onChange={(value) => update('resourceUrl', value)}
        required={!isAchievement}
      />
    </div>
  );
}

function AchievementMediaPreview({ form }) {
  const selectedFiles = useMemo(
    () => [...(form.wallpaperFiles || []), ...(form.videoFile ? [form.videoFile] : [])],
    [form.videoFile, form.wallpaperFiles]
  );
  const selectedMedia = useMemo(
    () =>
      selectedFiles.map((file, index) => ({
        key: `selected-${index}-${file.name}`,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
        name: file.name,
        selected: true,
      })),
    [selectedFiles]
  );

  useEffect(
    () => () => selectedMedia.forEach((item) => URL.revokeObjectURL(item.url)),
    [selectedMedia]
  );

  const existingMedia = form.media?.length
    ? form.media.map((item, index) => ({
        ...item,
        key: `existing-${index}-${item.url}`,
        url: resolveAssetUrl(item.url),
        name: `Saved ${item.type}`,
      }))
    : form.resourceUrl
      ? [
          {
            key: 'existing-resource',
            url: resolveAssetUrl(form.resourceUrl),
            type: 'image',
            name: 'Saved image',
          },
        ]
      : [];
  const previewMedia = [...existingMedia, ...selectedMedia];

  if (!previewMedia.length)
    return (
      <div className="achievement-preview-empty">
        Selected achievement images and video will appear here.
      </div>
    );
  return (
    <div className="achievement-preview">
      <div className="achievement-preview-heading">
        <strong>Achievement media preview</strong>
        <small>
          {previewMedia.length} item{previewMedia.length === 1 ? '' : 's'} · This media will display
          on the website and app
        </small>
      </div>
      <div className="achievement-preview-grid">
        {previewMedia.map((item) => (
          <figure key={item.key}>
            {item.type === 'video' ? (
              <video src={item.url} controls preload="metadata" />
            ) : (
              <img src={item.url} alt={item.name} />
            )}
            <figcaption>
              <span>{item.selected ? 'New' : 'Saved'}</span>
              {item.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
function Field({ label, type = 'text', value, onChange, required = true, as = 'input' }) {
  return (
    <label>
      <span>{label}</span>
      {as === 'textarea' ? (
        <textarea
          required={required}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          required={required}
          type={type}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
