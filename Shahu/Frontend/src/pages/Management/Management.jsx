import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen, FiEdit2, FiEye, FiPlus, FiTrash2, FiUsers, FiX } from 'react-icons/fi';
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
  courseType: 'Professional',
  hasDiscount: false,
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
  statusReason: '',
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
  paymentMode: 'direct-upi',
  merchantType: 'personal',
  merchantDisplayName: '',
  merchantCategoryCode: '',
  upiHandleProvider: '',
  supportsGpay: true,
  supportsPhonePe: true,
  supportsBhim: true,
  supportsPaytm: true,
  isQrEnabled: false,
  qrType: 'static',
  qrFile: null,
  remarks: '',
  instructions: '',
  accountNo: '',
  ifsc: '',
  accountType: 'upi',
  bankName: '',
  gatewayName: '',
  merchantId: '',
  defaultAccount: false,
  status: 'active',
};
const initialRecord = { title: '', description: '', course: '', subject: '', scheduledAt: '', status: 'active', resourceUrl: '' };
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
  const navigate = useNavigate();
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
      const records = response.data.data || [];
      setItems(
        isCourse
          ? [...records].sort(
              (first, second) =>
                new Date(second.createdAt || 0).getTime() -
                new Date(first.createdAt || 0).getTime()
            )
          : records
      );
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
        actualPrice: item.actualPriceDisplay ?? item.actualPrice ?? item.price ?? item.fees ?? '',
        courseType: item.courseType || 'Professional',
        hasDiscount: Number(item.discountValue ?? item.discountPercent ?? 0) > 0,
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
        subject: item.subject?._id || item.subject || '',
        scheduledAt: item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : '',
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
        if (!form.subjects?.length) {
          toast.error('Select at least one subject for this course');
          return;
        }

        let imageUrl = form.imageUrl;
        if (form.imageFile) {
          const uploadData = new FormData();
          uploadData.append('file', form.imageFile);
          const upload = await apiClient.post('/upload', uploadData);
          imageUrl = upload.data.data.url;
        }
        const statusChanged = editing && form.status !== editing.status;
        if (statusChanged && !String(form.statusReason || '').trim()) {
          toast.error('Enter a reason before changing the course status');
          return;
        }
        payload = {
          ...form,
          imageUrl,
          durationDays: Number(form.durationDays || 0),
          actualPrice: String(form.actualPrice || '0').trim(),
          discountType: form.discountType || 'percentage',
          discountValue: form.hasDiscount ? Number(form.discountValue || 0) : 0,
          offerText: String(form.offerText || '').trim(),
          benefits: splitLines(form.benefitsText),
          useCases: splitLines(form.useCasesText),
          highlights: splitLines(form.highlightsText),
          updateReason: editing
            ? statusChanged
              ? `Course ${form.status}: ${form.statusReason}`
              : 'Course details updated from admin panel'
            : undefined,
        };
        delete payload.imageFile;
        delete payload.hasDiscount;
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
        if (!/^[a-z0-9._-]{2,256}@[a-z0-9._-]{2,64}$/i.test(String(form.upiId || '').trim())) {
          toast.error('Enter a complete UPI ID with @ handle, for example 7030901355@ibl');
          return;
        } else
        {
          let qrCode = form.qrCode;
          if (form.qrFile) {
            const uploadData = new FormData();
            uploadData.append('file', form.qrFile);
            const upload = await apiClient.post('/upload', uploadData);
            qrCode = upload.data.data.url;
          }
          payload = {
          title: form.title,
          description: form.description,
          payload: {
            accountName: form.accountName,
            qrCode,
            mobileNo: form.mobileNo,
            upiId: form.upiId,
            paymentMode: form.paymentMode,
            merchantType: form.merchantType,
            merchantDisplayName: form.merchantDisplayName,
            merchantCategoryCode: form.merchantCategoryCode,
            upiHandleProvider: form.upiHandleProvider,
            supportsGpay: Boolean(form.supportsGpay),
            supportsPhonePe: Boolean(form.supportsPhonePe),
            supportsBhim: Boolean(form.supportsBhim),
            supportsPaytm: Boolean(form.supportsPaytm),
            isQrEnabled: Boolean(form.isQrEnabled),
            qrType: form.qrType,
            remarks: form.remarks,
            instructions: form.instructions,
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
        }
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
              {(resource === 'achievements' && item.resourceUrl) || (isCourse && item.imageUrl) ? (
                <img
                  className="achievement-thumbnail course-thumbnail"
                  src={resolveAssetUrl(item.resourceUrl || item.imageUrl)}
                  alt={item.title || item.name || 'Course image'}
                />
              ) : (
                <span className="resource-mark">
                  {(item.name || item.title || 'R').slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <div className="resource-title-row">
                  <strong>{item.name || item.title || item.payload?.studentName}</strong>
                  {isCourse ? (
                    <small>
                      Created{' '}
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString('en-IN')
                        : 'recently'}
                    </small>
                  ) : null}
                </div>
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
                {isCourse && (
                  <>
                    <small className="course-list-meta">
                      {item.courseCode || item.courseId || 'Course code pending'} · {item.courseType || 'Professional'} · Current price ₹{Number(item.fees ?? item.actualPrice ?? 0).toLocaleString('en-IN')}
                      {item.actualPrice && Number(item.actualPrice) !== Number(item.fees) ? (
                        <> · Original ₹{Number(item.actualPrice).toLocaleString('en-IN')}</>
                      ) : null}
                    </small>
                    {item.priceHistory?.length ? (
                      <details className="course-price-history">
                        <summary>Price update history ({item.priceHistory.length})</summary>
                        {item.priceHistory.slice().reverse().map((change, index) => (
                          <small key={`${change.changedAt || index}-${index}`}>
                            {change.changedAt
                              ? new Date(change.changedAt).toLocaleString('en-IN')
                              : 'Recently'}{' '}
                            · ₹{Number(change.previousPayablePrice || 0).toLocaleString('en-IN')} → ₹{Number(change.updatedPayablePrice || 0).toLocaleString('en-IN')}
                            {change.reason ? ` · ${change.reason}` : ''}
                          </small>
                        ))}
                      </details>
                    ) : null}
                  </>
                )}
              </div>
              <span className="status-pill">{item.status || 'active'}</span>
              {!isPurchases && (
                <div className="row-actions">
                  {isCourse ? (
                    <>
                      <button className="text-button" onClick={() => navigate(`/learning?course=${item._id}`)}>
                        <FiBookOpen /> Syllabus
                      </button>
                      <button className="text-button" onClick={() => navigate(`/students?course=${item._id}`)}>
                        <FiUsers /> Users
                      </button>
                    </>
                  ) : null}
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
                editing={editing}
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

function CourseFields({ form, update, editing, paymentAccounts, activeSubjects }) {
  const original = Number(form.actualPrice || 0);
  const discount = form.hasDiscount ? Number(form.discountValue || 0) : 0;
  const payable = Math.max(0, Number((form.discountType === 'fixed' ? original - discount : original - (original * discount) / 100).toFixed(2)));
  const selectedSubjectIds = (form.subjects || []).map((item) => item._id || item);
  return (
    <div className="student-fields">
      <h3 className="full-field course-form-heading">Course essentials</h3>
      <Field label="Course name" value={form.name} onChange={(value) => update('name', value)} />
      <label>
        <span>Course type</span>
        <select value={form.courseType || 'Professional'} onChange={(event) => update('courseType', event.target.value)}>
          <option value="UI">UI</option>
          <option value="Professional">Professional</option>
        </select>
      </label>
      <Field
        label="Validity (days)"
        type="number"
        value={form.durationDays}
        onChange={(value) => update('durationDays', value)}
      />
      <div className="course-offer-fields">
        <h3>Pricing and offer</h3>
        <Field
          label="Original price (INR)"
          type="number"
          step="0.01"
          value={form.actualPrice}
          onChange={(value) => update('actualPrice', value)}
        />
        <label className="course-discount-toggle">
          <input
            checked={Boolean(form.hasDiscount)}
            onChange={(event) => update('hasDiscount', event.target.checked)}
            type="checkbox"
          />
          <span>Add a discount for this course</span>
        </label>
        {form.hasDiscount ? (
          <>
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
            />
          </>
        ) : null}
        <label>
          <span>Payable price (calculated)</span>
          <input value={`₹${payable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} readOnly />
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
      <h3 className="full-field course-form-heading">Payment and availability</h3>
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
      <label>
        <span>Course status</span>
        <select value={form.status || 'active'} onChange={(event) => update('status', event.target.value)}>
          <option value="active">Active — visible to students</option>
          <option value="inactive">Inactive — hidden from students</option>
        </select>
      </label>
      {editing && form.status !== editing.status ? (
        <Field
          label={`Reason for changing status to ${form.status}`}
          value={form.statusReason}
          onChange={(value) => update('statusReason', value)}
          placeholder="Example: Admissions are temporarily closed"
        />
      ) : null}
      <h3 className="full-field course-form-heading">Subjects</h3>
      <fieldset className="full-field subject-picker">
        <legend>Select course subjects</legend>
        <small>Choose one or more subjects saved in the subject database.</small>
        {activeSubjects.length === 0 ? (
          <p className="muted">No active subjects are available. Create a subject first.</p>
        ) : activeSubjects.map((subject) => {
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
                }}
              />
              <span>
                <b>{subject.name}</b>
                <small>Course code: {subject.subjectCode || subject.subjectId || 'Not assigned'}</small>
              </span>
            </label>
          );
        })}
      </fieldset>
      <h3 className="full-field course-form-heading">Image and course details</h3>
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
      />
      <Field
        label="Where this course helps (one per line)"
        as="textarea"
        value={form.useCasesText}
        onChange={(value) => update('useCasesText', value)}
      />
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
      />
      <label><span>Payment mode</span><select value={form.paymentMode || 'direct-upi'} onChange={(event) => update('paymentMode', event.target.value)}><option value="direct-upi">Direct UPI</option><option value="merchant-gateway">Merchant Gateway</option></select></label>
      <label><span>Merchant type</span><select value={form.merchantType || 'personal'} onChange={(event) => update('merchantType', event.target.value)}><option value="personal">Personal</option><option value="business">Business</option></select></label>
      <Field label="Merchant display name" value={form.merchantDisplayName} onChange={(value) => update('merchantDisplayName', value)} required={false} />
      <Field label="Merchant category code (optional)" value={form.merchantCategoryCode} onChange={(value) => update('merchantCategoryCode', value)} required={false} />
      <Field label="UPI handle provider (for example: ibl, okaxis, ybl)" value={form.upiHandleProvider} onChange={(value) => update('upiHandleProvider', value)} required={false} />
      <div className="payment-support-options">
        <label><input checked={Boolean(form.supportsGpay)} onChange={(event) => update('supportsGpay', event.target.checked)} type="checkbox" /> Supports GPay</label>
        <label><input checked={Boolean(form.supportsPhonePe)} onChange={(event) => update('supportsPhonePe', event.target.checked)} type="checkbox" /> Supports PhonePe</label>
        <label><input checked={Boolean(form.supportsBhim)} onChange={(event) => update('supportsBhim', event.target.checked)} type="checkbox" /> Supports BHIM</label>
        <label><input checked={Boolean(form.supportsPaytm)} onChange={(event) => update('supportsPaytm', event.target.checked)} type="checkbox" /> Supports Paytm</label>
      </div>
      <label><input checked={Boolean(form.isQrEnabled)} onChange={(event) => update('isQrEnabled', event.target.checked)} type="checkbox" /> Enable QR payment</label>
      {form.isQrEnabled ? <><label><span>QR type</span><select value={form.qrType || 'static'} onChange={(event) => update('qrType', event.target.value)}><option value="static">Static</option><option value="dynamic">Dynamic</option></select></label><Field label="QR code image URL" value={form.qrCode} onChange={(value) => update('qrCode', value)} required={false} /><label><span>Upload QR code image</span><input accept="image/*" type="file" onChange={(event) => update('qrFile', event.target.files?.[0] || null)} /></label>{form.qrCode ? <img alt="Payment QR preview" className="payment-qr-preview" src={resolveAssetUrl(form.qrCode)} /> : null}</> : null}
      <Field label="Payment instructions" as="textarea" value={form.instructions} onChange={(value) => update('instructions', value)} required={false} />
      <Field label="Remarks" as="textarea" value={form.remarks} onChange={(value) => update('remarks', value)} required={false} />
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
  const isVideo = resource === 'videos';
  const selectedCourse = courses.find((course) => String(course._id) === String(form.course));
  const subjects = selectedCourse?.subjectDetails || selectedCourse?.subjects || [];
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
      {isVideo ? <>
        <label>
          <span>Subject</span>
          <select required value={form.subject || ''} onChange={(event) => update('subject', event.target.value)}>
            <option value="">Select subject</option>
            {subjects.map((subject) => <option key={subject._id || subject.subject || subject} value={subject._id || subject.subject || subject}>{subject.name || subject.subject?.name || 'Subject'}</option>)}
          </select>
        </label>
        <label><span>Live date and time</span><input required min={new Date().toISOString().slice(0, 16)} type="datetime-local" value={form.scheduledAt || ''} onChange={(event) => update('scheduledAt', event.target.value)} /></label>
      </> : null}
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
        label={isAchievement ? 'Image URL (optional)' : isVideo ? 'YouTube live link' : 'Resource link / URL'}
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
function Field({
  label,
  type = 'text',
  value,
  onChange,
  required = true,
  as = 'input',
  step,
  placeholder = `Enter ${label.toLowerCase()}`,
}) {
  return (
    <label>
      <span>{label}</span>
      {as === 'textarea' ? (
        <textarea
          placeholder={placeholder}
          required={required}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          placeholder={placeholder}
          required={required}
          type={type}
          step={step}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
