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
import founderLogo from '../../assets/lokaraja-founder.png';

export function LoginModal({ open, onClose }) {
  const navigate = useNavigate();
  const { login, loading, isAuthenticated, user } = useAuth();
  const [resetting, setResetting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: yupResolver(loginSchema), defaultValues: { email: '', password: '' } });
  useEffect(() => { if (isAuthenticated) { onClose(); navigate(ROUTES.dashboard, { replace: true, state: { portal: user?.role } }); } }, [isAuthenticated, navigate, onClose, user?.role]);
  const requestPasswordReset = async () => {
    const email = window.prompt('Enter your Admin, Super Admin, or student email address.');
    if (!email?.trim()) return;
    setResetting(true);
    try {
      const response = await authService.forgotPassword(email.trim());
      window.alert(response.message || 'If the account is valid, a temporary password has been sent.');
    } catch (error) {
      window.alert(error.response?.data?.message || 'Unable to request a temporary password.');
    } finally { setResetting(false); }
  };
  return <AnimatePresence>{open && <motion.div className="login-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}><motion.section className="login-modal" initial={{ opacity: 0, y: 28, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .98 }} transition={{ type: 'spring', damping: 24 }} onMouseDown={event => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Close login" onClick={onClose}><FiX /></button><img className="login-founder-logo" src={founderLogo} alt="GS BY Anand Sir" /><p className="eyebrow">GS BY Anand Sir</p><h2>Welcome to your portal</h2><p className="muted">Sign in to access academic tools and updates.</p><form className="login-form" onSubmit={handleSubmit(login)}><label><span>Email address</span><div className="modal-input"><FiMail /><input type="email" placeholder="you@example.com" {...register('email')} /></div>{errors.email && <small>{errors.email.message}</small>}</label><label><span>Password</span><div className="modal-input"><FiLock /><input type="password" placeholder="Enter your password" {...register('password')} /></div>{errors.password && <small>{errors.password.message}</small>}</label><div className="login-meta"><label className="remember"><input type="checkbox" /> Remember me</label><button disabled={resetting} onClick={requestPasswordReset} type="button">{resetting ? 'Sending…' : 'Forgot password?'}</button></div><button className="btn modal-submit" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign in'} <FiArrowRight /></button></form></motion.section></motion.div>}</AnimatePresence>;
}
