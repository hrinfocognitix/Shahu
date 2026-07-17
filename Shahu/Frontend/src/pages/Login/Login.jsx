import { yupResolver } from '@hookform/resolvers/yup';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiArrowRight, FiChevronLeft, FiChevronRight, FiLock, FiMail, FiShield } from 'react-icons/fi';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../hooks/useAuth';
import { loginSchema } from '../../validators/auth.validator';
import founderLogo from '../../assets/lokaraja-founder.png';

const slides = [
  { image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=85', eyebrow: 'LEARN WITH PURPOSE', title: 'A clear path for every ambitious learner.', copy: 'Structured courses, personal guidance, and the right tools to keep progress moving.' },
  { image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1600&q=85', eyebrow: 'GROW WITH GUIDANCE', title: 'Preparation that builds confidence.', copy: 'Learn from experienced mentors and stay connected to your academic journey.' },
  { image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&q=85', eyebrow: 'ACHIEVE TOGETHER', title: 'Your next milestone starts here.', copy: 'Access lessons, exam updates, study material, and results in one place.' }
];

export function Login() {
  const { login, loading, isAuthenticated } = useAuth();
  const [activeSlide, setActiveSlide] = useState(0);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: yupResolver(loginSchema), defaultValues: { email: 'admin@cognitix.com', password: '12345678' } });

  useEffect(() => {
    const interval = window.setInterval(() => setActiveSlide(current => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(interval);
  }, []);

  if (isAuthenticated) return <Navigate to={ROUTES.dashboard} replace />;
  const slide = slides[activeSlide];
  const changeSlide = direction => setActiveSlide(current => (current + direction + slides.length) % slides.length);

  return <section className="portal-login"><div className="login-showcase"><AnimatePresence mode="wait"><motion.div key={slide.image} className="login-slide-image" style={{ backgroundImage: `url(${slide.image})` }} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: .7 }} /></AnimatePresence><div className="login-slide-shade" /><div className="login-showcase-brand"><span className="brand-seal">ल</span><span>Lokaraja <small>Career Academy</small></span></div><motion.div key={slide.title} className="login-slide-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .14 }}><p>{slide.eyebrow}</p><h1>{slide.title}</h1><span>{slide.copy}</span></motion.div><div className="login-slide-controls"><button type="button" aria-label="Previous slide" onClick={() => changeSlide(-1)}><FiChevronLeft /></button><div>{slides.map((item, index) => <button type="button" key={item.title} aria-label={`Show slide ${index + 1}`} className={index === activeSlide ? 'active' : ''} onClick={() => setActiveSlide(index)} />)}</div><button type="button" aria-label="Next slide" onClick={() => changeSlide(1)}><FiChevronRight /></button></div></div><main className="login-panel"><div className="login-panel-inner"><div className="login-mobile-brand"><img src={founderLogo} alt="Lokaraja Career Academy" /><span>Lokaraja <small>Career Academy</small></span></div><div className="login-heading"><p>ACADEMY PORTAL</p><h2>Welcome back.</h2><span>Sign in to continue your learning journey.</span></div><form onSubmit={handleSubmit(login)} className="portal-login-form"><label><span>Email address</span><div className={errors.email ? 'portal-input has-error' : 'portal-input'}><FiMail /><input type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} /></div>{errors.email && <small>{errors.email.message}</small>}</label><label><span>Password</span><div className={errors.password ? 'portal-input has-error' : 'portal-input'}><FiLock /><input type="password" autoComplete="current-password" placeholder="Enter your password" {...register('password')} /></div>{errors.password && <small>{errors.password.message}</small>}</label><div className="login-assurance"><span><FiShield /> Secure academy access</span><button type="button">Forgot password?</button></div><button className="portal-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : <>Sign in to your portal <FiArrowRight /></>}</button></form><p className="login-help">Need access? Please contact your academy administrator.</p></div></main></section>;
}
