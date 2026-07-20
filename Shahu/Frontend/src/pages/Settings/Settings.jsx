import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import i18n from '../../translations/i18n';
import { useTranslation } from 'react-i18next';
import { setLocale } from '../../redux/slices/uiSlice';
import { apiClient } from '../../api/axios';

export function Settings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const locale = useSelector(state => state.ui.locale);
  const user = useSelector(state => state.auth.user);
  const [file, setFile] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const changeLocale = value => {
    dispatch(setLocale(value));
    i18n.changeLanguage(value);
  };

  const saveSplash = async event => {
    event.preventDefault();
    if (!file) return toast.error(t('portalSettings.chooseFirst', { type: t(`portalSettings.${mediaType}`) }));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      formData.append('mediaType', mediaType);
      formData.append('startsAt', new Date(startsAt).toISOString());
      formData.append('endsAt', new Date(endsAt).toISOString());
      await apiClient.post('/splash-screens', formData);
      setFile(null); setMediaType('image'); setStartsAt(''); setEndsAt('');
      toast.success(t('portalSettings.saved'));
    } catch (error) { toast.error(error.response?.data?.message || t('portalSettings.saveError')); } finally { setUploading(false); }
  };

  return (
    <section className="settings-page stack">
      <div className="card stack"><h2>{t('portalSettings.title')}</h2>
      <label className="field">
        <span>{t('portalSettings.language')}</span>
        <select value={locale} onChange={event => changeLocale(event.target.value)}>
          <option value="en">English</option>
          <option value="mr">मराठी</option>
        </select>
      </label>
      </div>
      {['admin', 'superadmin'].includes(user?.role) && <form className="card stack splash-form" onSubmit={saveSplash}><div><p className="eyebrow">{t('portalSettings.splashEyebrow')}</p><h2>{t('portalSettings.splashTitle')}</h2><p className="muted">{t('portalSettings.splashHelp')}</p></div><label className="field"><span>{t('portalSettings.mediaType')}</span><select value={mediaType} onChange={event => { setMediaType(event.target.value); setFile(null); }}><option value="image">{t('portalSettings.image')}</option><option value="video">{t('portalSettings.video')}</option></select></label><label className="field"><span>{t(`portalSettings.${mediaType}`)}</span><input type="file" accept={mediaType === 'video' ? 'video/*' : 'image/*'} required onChange={event => setFile(event.target.files?.[0] || null)} /></label>{previewUrl && <div className="splash-preview">{mediaType === 'video' ? <video src={previewUrl} controls muted /> : <img src={previewUrl} alt={t('portalSettings.splashTitle')} />}<small>{t('portalSettings.previewHelp')}</small></div>}<div className="student-fields"><label><span>{t('portalSettings.visibleFrom')}</span><input required type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label><label><span>{t('portalSettings.visibleUntil')}</span><input required type="datetime-local" value={endsAt} min={startsAt} onChange={event => setEndsAt(event.target.value)} /></label></div><button className="btn btn-primary" disabled={uploading}>{uploading ? t('portalSettings.uploading') : t('portalSettings.uploadSchedule')}</button></form>}
    </section>
  );
}
