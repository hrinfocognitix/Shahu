import { yupResolver } from '@hookform/resolvers/yup';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiArrowRight, FiLock, FiMail, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import { loginSchema } from '../../validators/auth.validator';
import brandLogo from '../../assets/gs-by-anand-sir-icon.png';

export function LoginModal({ open, onClose }) {
  const navigate = useNavigate();
  const { login, loading, isAuthenticated, user } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [resetCooldownUntil, setResetCooldownUntil] = useState(() => Number(localStorage.getItem('forgot-password-cooldown-until') || 0));
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: yupResolver(loginSchema), defaultValues: { email: '', password: '' } });
  useEffect(() => { if (isAuthenticated) { onClose(); navigate(ROUTES.dashboard, { replace: true, state: { portal: user?.role } }); } }, [isAuthenticated, navigate, onClose, user?.role]);
  useEffect(() => {
    if (resetCooldownUntil <= Date.now()) return undefined;
    const timer = window.setTimeout(() => setResetCooldownUntil(0), resetCooldownUntil - Date.now());
    return () => window.clearTimeout(timer);
  }, [resetCooldownUntil]);
  const requestPasswordReset = async () => {
    if (resetCooldownUntil > Date.now()) return;
    const email = window.prompt('Enter your Admin, Super Admin, or student email address.');
    if (!email?.trim()) return;
    setResetting(true);
    try {
      const response = await authService.forgotPassword(email.trim());
      const cooldownUntil = new Date(response.data?.cooldownUntil || '').getTime();
      if (Number.isFinite(cooldownUntil) && cooldownUntil > Date.now()) {
        localStorage.setItem('forgot-password-cooldown-until', String(cooldownUntil));
        setResetCooldownUntil(cooldownUntil);
      }
      window.alert(response.message || 'If the account is valid, a temporary password has been sent.');
    } catch (error) {
      window.alert(error.response?.data?.message || 'Unable to request a temporary password.');
    } finally { setResetting(false); }
  };
  const resetCooling = resetCooldownUntil > Date.now();
  return <AnimatePresence>{open && <motion.div className="login-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}><motion.section className="login-modal" initial={{ opacity: 0, y: 28, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .98 }} transition={{ type: 'spring', damping: 24 }} onMouseDown={event => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Close login" onClick={onClose}><FiX /></button><img className="login-founder-logo" src={brandLogo} alt="GS BY Anand Sir" /><p className="eyebrow">GS BY Anand Sir</p><h2>Welcome to your portal</h2><p className="muted">Sign in to access academic tools and updates.</p><form className="login-form" onSubmit={handleSubmit(login)}><label><span>Email address</span><div className="modal-input"><FiMail /><input type="email" placeholder="you@example.com" {...register('email')} /></div>{errors.email && <small>{errors.email.message}</small>}</label><label><span>Password</span><div className="modal-input"><FiLock /><input type="password" placeholder="Enter your password" {...register('password')} /></div>{errors.password && <small>{errors.password.message}</small>}</label><div className="login-meta"><label className="remember"><input type="checkbox" /> Remember me</label><button disabled={resetting || resetCooling} onClick={requestPasswordReset} type="button">{resetting ? 'Sending…' : resetCooling ? 'Forgot password disabled for 12 hours' : 'Forgot password?'}</button></div><p className="forgot-password-support">Forgot-password requests are disabled for 12 hours after use. For help, call <a href="tel:+919422592552">9422592552</a> or email <a href="mailto:chavanravsaheb5@gmail.com">chavanravsaheb5@gmail.com</a>.</p><button className="btn modal-submit" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign in'} <FiArrowRight /></button></form></motion.section></motion.div>}</AnimatePresence>;
}
