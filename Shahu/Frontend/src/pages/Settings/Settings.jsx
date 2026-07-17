import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import i18n from '../../translations/i18n';
import { setLocale } from '../../redux/slices/uiSlice';
import { apiClient } from '../../api/axios';
import { environment } from '../../config/environment';

export function Settings() {
  const dispatch = useDispatch();
  const locale = useSelector(state => state.ui.locale);
  const user = useSelector(state => state.auth.user);
  const [file, setFile] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [uploading, setUploading] = useState(false);

  const changeLocale = value => {
    dispatch(setLocale(value));
    i18n.changeLanguage(value);
  };

  const saveSplash = async event => {
    event.preventDefault();
    if (!file) return toast.error(`Choose a splash screen ${mediaType === 'video' ? 'video' : 'image'} first`);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const upload = await apiClient.post('/upload', formData);
      const imageUrl = `${environment.apiBaseUrl.replace(/\/api\/v1$/, '')}${upload.data.data.url}`;
      await apiClient.post('/splash-screens', {
        title: file.name,
        imageUrl,
        videoUrl: mediaType === 'video' ? imageUrl : '',
        mediaType,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString()
      });
      setFile(null); setMediaType('image'); setStartsAt(''); setEndsAt('');
      toast.success('Scheduled splash screen saved');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to save splash screen'); } finally { setUploading(false); }
  };

  return (
    <section className="settings-page stack">
      <div className="card stack"><h2>Settings</h2>
      <label className="field">
        <span>Language</span>
        <select value={locale} onChange={event => changeLocale(event.target.value)}>
          <option value="en">English</option>
          <option value="mr">मराठी</option>
        </select>
      </label>
      </div>
      {user?.role === 'admin' && <form className="card stack splash-form" onSubmit={saveSplash}><div><p className="eyebrow">SPLASH SCREEN UPLOAD</p><h2>Upload splash screen</h2><p className="muted">Upload an image or video. The app uses it when the API responds in time, otherwise it falls back to the built-in default splash screen.</p></div><label className="field"><span>Media type</span><select value={mediaType} onChange={event => setMediaType(event.target.value)}><option value="image">Image</option><option value="video">Video</option></select></label><label className="field"><span>{mediaType === 'video' ? 'Video' : 'Image'}</span><input type="file" accept={mediaType === 'video' ? 'video/*' : 'image/*'} required onChange={event => setFile(event.target.files?.[0] || null)} /></label><div className="student-fields"><label><span>Visible from</span><input required type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label><label><span>Visible until</span><input required type="datetime-local" value={endsAt} min={startsAt} onChange={event => setEndsAt(event.target.value)} /></label></div><button className="btn btn-primary" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload and schedule'}</button></form>}
    </section>
  );
}
