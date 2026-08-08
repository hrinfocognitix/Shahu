import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiChevronDown, FiLogOut, FiMenu, FiMoon, FiSun } from 'react-icons/fi';
import { toggleSidebar } from '../../redux/slices/uiSlice';
import { logout } from '../../redux/slices/authSlice';
import { useTheme } from '../../hooks/useTheme';
import { authService } from '../../services/auth.service';
import { STORAGE_KEYS } from '../../constants';
import { useTranslation } from 'react-i18next';

const expiresAt = token => {
  try { return JSON.parse(atob(token.split('.')[1])).exp * 1000; } catch { return 0; }
};
const MAX_FRONTEND_SESSION_MS = 30 * 60 * 1000;

export function Header() {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const refreshToken = useSelector(state => state.auth.refreshToken);
  const accessToken = useSelector(state => state.auth.accessToken);
  const { mode, toggleTheme } = useTheme();
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const endSession = () => { localStorage.removeItem(STORAGE_KEYS.auth); dispatch(logout()); navigate('/', { replace: true }); };
  const handleLogout = async () => { try { await authService.logout(refreshToken); } catch {} finally { endSession(); } };

  useEffect(() => {
    // Never keep a portal session longer than 30 minutes, even if a future
    // backend configuration issues a longer access token.
    const remaining = Math.min(expiresAt(accessToken) - Date.now(), MAX_FRONTEND_SESSION_MS);
    if (remaining <= 0) { endSession(); return undefined; }
    const timeout = window.setTimeout(endSession, remaining);
    return () => window.clearTimeout(timeout);
  }, [accessToken]);

  return (
    <header className="header">
      <button type="button" className="icon-button" onClick={() => dispatch(toggleSidebar())}>
        <FiMenu />
      </button>
      <div className="header-actions">
        <div className="portal-language" aria-label="Language">
          <button className={i18n.language === 'en' ? 'active' : ''} onClick={() => { i18n.changeLanguage('en'); localStorage.setItem('locale', 'en'); }}>EN</button>
          <button className={i18n.language === 'mr' ? 'active' : ''} onClick={() => { i18n.changeLanguage('mr'); localStorage.setItem('locale', 'mr'); }}>मराठी</button>
        </div>
        <button type="button" className="icon-button notification-button" aria-label="Notifications"><FiBell /><i /></button>
        <button type="button" className="icon-button" onClick={toggleTheme}>
          {mode === 'dark' ? <FiSun /> : <FiMoon />}
        </button>
        <div className="user-menu"><span className="user-avatar">{(user?.name || 'Admin').charAt(0).toUpperCase()}</span><span className="user-details"><strong>{user?.name || 'Admin'}</strong><small>{user?.role || 'Administrator'}</small></span><FiChevronDown /></div>
        <button type="button" className="logout-button" onClick={handleLogout}><FiLogOut /><span>{t('Logout', 'Logout')}</span></button>
      </div>
    </header>
  );
}
