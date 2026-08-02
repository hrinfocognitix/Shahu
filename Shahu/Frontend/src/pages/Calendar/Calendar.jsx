import { useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiImage, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { apiClient } from '../../api/axios';

const weekdays = ['रवि', 'सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि'];
const dateKey = (value) => new Date(value).toLocaleDateString('en-CA');
const dayStart = (value) => new Date(`${dateKey(value)}T00:00:00`);
const dayEnd = (value) => new Date(`${dateKey(value)}T23:59:59.999`);
const portraitMediaIsValid = (file) => new Promise((resolve, reject) => {
  const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
  const objectUrl = URL.createObjectURL(file);
  media.onloadedmetadata = media.onload = () => {
    const width = media.videoWidth || media.naturalWidth;
    const height = media.videoHeight || media.naturalHeight;
    URL.revokeObjectURL(objectUrl);
    if (width < 720 || height < 1280 || width / height < 0.45 || width / height > 0.65) {
      reject(new Error('Use a portrait 9:16 splash file, at least 720 × 1280 pixels. 1080 × 1920 is recommended.'));
      return;
    }
    resolve();
  };
  media.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Unable to read the selected media file')); };
  media.src = objectUrl;
});

export function Calendar() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [splashes, setSplashes] = useState([]);
  const [festivalMedia, setFestivalMedia] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', startDate: '', description: '', type: 'holiday' });
  const [visibilityDuration, setVisibilityDuration] = useState('24');
  const [customDuration, setCustomDuration] = useState('');
  const mediaPreviewUrl = useMemo(() => festivalMedia ? URL.createObjectURL(festivalMedia) : '', [festivalMedia]);

  useEffect(() => () => { if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl); }, [mediaPreviewUrl]);

  const load = async () => {
    try {
      const [eventResponse, splashResponse] = await Promise.all([
        apiClient.get('/calendar', { params: { limit: 300 } }),
        apiClient.get('/splash-screens'),
      ]);
      setEvents(eventResponse.data.data || []);
      setSplashes(splashResponse.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load calendar');
    }
  };

  useEffect(() => { load(); }, []);

  const monthLabel = new Intl.DateTimeFormat('mr-IN', { month: 'long', year: 'numeric' }).format(month);
  const days = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: firstDay.getDay() + count }, (_, index) =>
      index < firstDay.getDay() ? null : new Date(month.getFullYear(), month.getMonth(), index - firstDay.getDay() + 1),
    );
  }, [month]);
  const festivalEvents = useMemo(
    () => events.filter((item) => item.type === 'holiday').sort((first, second) => new Date(first.startDate) - new Date(second.startDate)),
    [events],
  );

  const hasScheduledSplash = (event) => splashes.some((item) =>
    item.isEnabled && new Date(item.startsAt) <= dayEnd(event.startDate) && new Date(item.endsAt) > dayStart(event.startDate),
  );
  const eventsOn = (day) => events.filter((item) => dateKey(item.startDate) === dateKey(day));

  const addFestival = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.startDate) return toast.error('Festival name and date are required');
    if (!festivalMedia) return toast.error('Choose a festival splash image or video');
    const durationHours = Number(visibilityDuration === 'custom' ? customDuration : visibilityDuration);
    if (!Number.isFinite(durationHours) || durationHours < 1) return toast.error('Enter a valid splash visibility duration');
    setSaving(true);
    try {
      if (festivalMedia) await portraitMediaIsValid(festivalMedia);
      const response = await apiClient.post('/calendar', { ...form, title: form.title.trim(), startDate: new Date(form.startDate).toISOString() });
      const createdFestival = response.data.data;
      const existingSplash = hasScheduledSplash(createdFestival);
      if (!existingSplash) {
        const data = new FormData();
        data.append('file', festivalMedia);
        data.append('title', `${createdFestival.title} splash screen`);
        data.append('mediaType', festivalMedia.type.startsWith('video/') ? 'video' : 'image');
        data.append('startsAt', dayStart(createdFestival.startDate).toISOString());
        data.append('endsAt', new Date(dayStart(createdFestival.startDate).getTime() + durationHours * 60 * 60 * 1000).toISOString());
        await apiClient.post('/splash-screens', data);
      }
      setForm({ title: '', startDate: '', description: '', type: 'holiday' });
      setFestivalMedia(null);
      toast.success(existingSplash ? 'Festival added; the existing splash screen was kept' : `Festival and splash screen added for ${durationHours} hours`);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Unable to add festival');
    } finally {
      setSaving(false);
    }
  };

  const permanentlyDeleteSplash = async (item) => {
    if (!window.confirm(`Permanently delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/splash-screens/${item._id}/permanent`);
      toast.success('Splash screen permanently deleted');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to permanently delete splash screen');
    }
  };

  return (
    <section className="marathi-calendar page-enter">
      <div className="page-heading">
        <div><p className="eyebrow">मराठी दिनदर्शिका</p><h1>Calendar & festival splash screens</h1><p>Add festival dates and schedule a festival splash only when one is not already active for that date.</p></div>
      </div>
      <div className="calendar-layout">
        <section className="calendar-board">
          <div className="calendar-month-nav"><button onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} type="button"><FiChevronLeft /></button><h2>{monthLabel}</h2><button onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} type="button"><FiChevronRight /></button></div>
          <div className="calendar-grid">{weekdays.map((day) => <strong key={day}>{day}</strong>)}{days.map((day, index) => day ? <div className={`calendar-day ${eventsOn(day).length ? 'has-event' : ''}`} key={dateKey(day)}><span>{new Intl.NumberFormat('mr-IN').format(day.getDate())}</span>{eventsOn(day).map((item) => <small key={item._id}>{item.title}</small>)}</div> : <div className="calendar-day empty" key={`empty-${index}`} />)}</div>
        </section>
        <form className="calendar-festival-form" onSubmit={addFestival}>
          <h2><FiPlus /> Add festival</h2>
          <input onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="Festival name in Marathi or English" required value={form.title} />
          <input onChange={(event) => setForm((value) => ({ ...value, startDate: event.target.value }))} required type="date" value={form.startDate} />
          <textarea onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="Festival details (optional)" value={form.description} />
          <label className="festival-media-field"><span>Festival splash image or video</span><input accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v" onChange={(event) => setFestivalMedia(event.target.files?.[0] || null)} required type="file" /><small>Portrait 9:16 only, minimum 720 × 1280. Recommended: 1080 × 1920 (Android) or 1170 × 2532 (iPhone).</small></label>
          {mediaPreviewUrl ? <div className="festival-media-preview">{festivalMedia.type.startsWith('video/') ? <video controls muted src={mediaPreviewUrl} /> : <img alt="Festival splash preview" src={mediaPreviewUrl} />}</div> : null}
          <label className="festival-duration-field"><span>Splash visibility duration</span><select onChange={(event) => setVisibilityDuration(event.target.value)} value={visibilityDuration}><option value="24">24 hours (default)</option><option value="48">48 hours</option><option value="52">52 hours</option><option value="custom">Enter custom hours</option></select></label>
          {visibilityDuration === 'custom' ? <input min="1" onChange={(event) => setCustomDuration(event.target.value)} placeholder="Enter number of hours" required type="number" value={customDuration} /> : null}
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add festival'}</button>
        </form>
      </div>
      <section className="festival-list"><h2>Festival splash screen status</h2>{festivalEvents.length ? festivalEvents.map((item) => <article key={item._id}><div><strong>{item.title}</strong><small>{new Date(item.startDate).toLocaleDateString('mr-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</small></div><span className={`status-pill ${hasScheduledSplash(item) ? '' : 'status-pending'}`}>{hasScheduledSplash(item) ? 'Splash already scheduled' : 'No splash uploaded'}</span></article>) : <p className="muted">Add a festival to start scheduling its splash screen.</p>}<h2 className="added-splash-heading"><FiImage /> Added splash screens</h2>{splashes.length ? splashes.map((item) => <article className="added-splash-row" key={item._id}><div><strong>{item.title}</strong><small>{new Date(item.startsAt).toLocaleDateString('mr-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {item.mediaType}</small></div><span className="status-pill">{item.isEnabled ? 'Scheduled' : 'Disabled'}</span><button aria-label={`Permanently delete ${item.title}`} className="text-button danger permanent-splash-delete" onClick={() => permanentlyDeleteSplash(item)} type="button"><FiTrash2 /> Permanently delete</button></article>) : <p className="muted">No splash screens have been added yet.</p>}</section>
    </section>
  );
}
