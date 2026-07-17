import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiArrowRight,
  FiAward,
  FiBookOpen,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiLayers,
  FiMapPin,
  FiTag,
  FiUsers
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axios';
import { LoginModal } from '../../components/LoginModal/LoginModal';
import { environment } from '../../config/environment';

const fallbackSlides = [
  { resourceUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1800&q=85', title: 'Shape a future you believe in.' },
  { resourceUrl: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1800&q=85', title: 'Guidance that unlocks potential.' },
  { resourceUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1800&q=85', title: 'Learn. Lead. Achieve.' }
];

const fallbackCourses = [
  {
    _id: 'fallback-1',
    name: 'MPSC & UPSC',
    description: 'Focused mentorship and current-affairs preparation.',
    durationDays: 180,
    durationMonths: 6,
    fees: 25000,
    imageUrl: 'http://localhost:5001/uploads/course-default-poster.png',
    benefits: ['Structured batches', 'Mock tests', 'Doubt-solving support'],
    useCases: ['Competitive exam preparation', 'Career progression'],
    highlights: ['Expert faculty', 'Daily study rhythm'],
    subjects: []
  },
  {
    _id: 'fallback-2',
    name: 'Banking & SSC',
    description: 'A high-performance plan for competitive exams.',
    durationDays: 120,
    durationMonths: 4,
    fees: 18000,
    imageUrl: 'http://localhost:5001/uploads/course-default-poster.png',
    benefits: ['Concept clarity', 'Timed practice papers', 'Revision support'],
    useCases: ['Banking exams', 'SSC exams'],
    highlights: ['Interview guidance', 'Smart analytics'],
    subjects: []
  },
  {
    _id: 'fallback-3',
    name: 'Foundation Courses',
    description: 'Build powerful habits for lifelong learning.',
    durationDays: 90,
    durationMonths: 3,
    fees: 12000,
    imageUrl: 'http://localhost:5001/uploads/course-default-poster.png',
    benefits: ['Core subjects', 'Mentor review', 'Consistent planning'],
    useCases: ['Academic foundation', 'Future advanced preparation'],
    highlights: ['Study routines', 'Progress milestones'],
    subjects: []
  }
];

function resolveAssetUrl(path) {
  const assetBase = environment.apiBaseUrl.replace(/\/api\/v1$/, '');
  if (!path) return `${assetBase}/uploads/course-default-poster.png`;
  return path.startsWith('http') ? path : `${assetBase}${path}`;
}

export function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [gallery, setGallery] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    apiClient
      .get('/achievements', { params: { limit: 5 } })
      .then(response => setAchievements((response.data.data || []).filter(item => item.resourceUrl).slice(0, 5)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiClient
      .get('/gallery', { params: { limit: 5 } })
      .then(response => setGallery((response.data.data || []).filter(item => item.resourceUrl).slice(0, 5)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiClient
      .get('/courses', { params: { limit: 6, status: 'active' } })
      .then(response => setCourses(response.data.data || []))
      .catch(() => setCourses([]));
  }, []);

  const visibleCourses = useMemo(() => (courses.length ? courses : fallbackCourses), [courses]);
  const courseSlides = useMemo(
    () =>
      visibleCourses
        .filter(course => course.imageUrl)
        .map(course => ({
          _id: course._id,
          resourceUrl: resolveAssetUrl(course.imageUrl),
          title: course.name,
          description: course.description
        })),
    [visibleCourses]
  );
  const slides = useMemo(() => {
    if (achievements.length) return achievements;
    if (gallery.length) return gallery;
    if (courseSlides.length) return courseSlides;
    return fallbackSlides;
  }, [achievements, courseSlides, gallery]);

  useEffect(() => {
    const timer = setInterval(() => setCurrent(index => (index + 1) % slides.length), 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const changeSlide = direction => setCurrent(index => (index + direction + slides.length) % slides.length);
  const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <main className="lokaraja">
      <header className="lokaraja-nav">
        <Link to="/" className="lokaraja-brand">
          <span className="brand-seal">ल</span>
          <span>
            Lokaraja <small>Career Academy</small>
          </span>
        </Link>
        <nav>
          {[
            ['Home', 'home'],
            ['About', 'about'],
            ['Courses', 'courses'],
            ['Teachers', 'teachers'],
            ['Gallery', 'gallery'],
            ['Online Exams', 'exams'],
            ['Study Materials', 'courses'],
            ['Contact', 'contact']
          ].map(([label, id]) => (
            <button key={label} type="button" onClick={() => jump(id)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="btn nav-login" type="button" onClick={() => setLoginOpen(true)}>
          Login <FiArrowRight />
        </button>
      </header>

      <section id="home" className="hero-slider">
        {slides.map((slide, index) => (
          <motion.div
            key={slide._id || slide.resourceUrl}
            className="hero-slide"
            initial={false}
            animate={{ opacity: index === current ? 1 : 0, scale: index === current ? 1 : 1.04 }}
            transition={{ duration: 0.8 }}
            aria-hidden={index !== current}>
            <img src={slide.resourceUrl} alt={slide.title || 'Lokaraja academy students'} loading={index ? 'lazy' : 'eager'} />
            <div className="hero-shade" />
          </motion.div>
        ))}
        <div className="hero-copy">
          <motion.p key={`tag-${current}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {achievements.length ? 'Achievement Wall' : 'लोकराजा करिअर अकादमी, थिकपुर्ली'}
          </motion.p>
          <motion.h1 key={`title-${current}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            {slides[current]?.title || 'Learn with purpose.'}
          </motion.h1>
          <span>{slides[current]?.description || 'Lokaraja Career Academy, Thikpurli'}</span>
          <button className="btn hero-button" onClick={() => jump('courses')}>
            Explore our courses <FiArrowRight />
          </button>
        </div>
        <div className="slider-controls">
          <button aria-label="Previous slide" onClick={() => changeSlide(-1)}>
            <FiChevronLeft />
          </button>
          <div className="slider-dots">
            {slides.map((slide, index) => (
              <button
                aria-label={`Show slide ${index + 1}`}
                className={index === current ? 'active' : ''}
                onClick={() => setCurrent(index)}
                key={slide._id || index}
              />
            ))}
          </div>
          <button aria-label="Next slide" onClick={() => changeSlide(1)}>
            <FiChevronRight />
          </button>
        </div>
        {achievements.length ? (
          <div className="achievement-strip">
            <span><FiAward /> Student achievements</span>
            <p>Mobile users now see the achievement wall first, followed by the available course list.</p>
          </div>
        ) : null}
      </section>

      <section id="about" className="intro-section">
        <div>
          <p className="eyebrow">A place to begin</p>
          <h2>Ambition deserves a clear path.</h2>
        </div>
        <div>
          <p>
            Lokaraja Career Academy helps learners turn effort into progress through rigorous teaching, personal mentorship and a study ecosystem built for consistency.
          </p>
          <div className="intro-stats">
            <span>
              <b>12+</b> years of trust
            </span>
            <span>
              <b>2,500+</b> learners guided
            </span>
            <span>
              <b>95%</b> satisfaction
            </span>
          </div>
        </div>
      </section>

      <section className="director-section">
        <div className="director-art">
          <span>ल</span>
        </div>
        <div>
          <p className="eyebrow">A note from our director</p>
          <h2>“The right guidance can transform a student’s confidence into achievement.”</h2>
          <p>Every learner comes with a different story. Our job is to make their next chapter stronger, calmer and full of possibility.</p>
          <strong>— Director, Lokaraja Career Academy</strong>
        </div>
      </section>

      <section id="courses" className="content-section">
        <p className="eyebrow">Our programs</p>
        <h2>Prepare with purpose.</h2>
        <div className="course-grid enhanced-course-grid">
          {visibleCourses.map((course, index) => (
            <motion.article
              whileHover={{ y: -8 }}
              key={course._id || course.name}
              className="lokaraja-card course-tile"
              style={{
                backgroundImage: `linear-gradient(180deg, rgb(28 22 18 / 12%), rgb(28 22 18 / 88%)), url(${resolveAssetUrl(course.imageUrl || fallbackCourses[0].imageUrl)})`
              }}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <FiBookOpen />
              <h3>{course.name}</h3>
              <p>{course.description}</p>
              <div className="course-tile-meta">
                <span>
                  <FiClock /> {course.durationDays || 0} days
                </span>
                <span>
                  <FiCalendar /> {course.durationMonths || (course.durationDays ? (course.durationDays / 30).toFixed(1) : '0')} months
                </span>
                <span>
                  <FiTag /> Rs. {Number(course.fees || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="course-tile-copy">
                {(course.benefits || []).slice(0, 2).map(item => (
                  <small key={item}>{item}</small>
                ))}
                {(course.useCases || []).slice(0, 1).map(item => (
                  <small key={item}>{item}</small>
                ))}
              </div>
              {course.subjects?.length ? (
                <div className="course-tile-subjects">
                  <span>
                    <FiLayers /> {course.subjects.length} subjects
                  </span>
                </div>
              ) : null}
              <Link to={`/courses/${course._id}`}>
                View program <FiArrowRight />
              </Link>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="teachers" className="teachers-section">
        <p className="eyebrow">Our mentors</p>
        <h2>Teachers who stay invested.</h2>
        <p>Experienced educators who bring depth, discipline and genuine care to every classroom.</p>
        <div className="teacher-list">
          {['Expert faculty', 'Personal mentorship', 'Doubt-solving sessions'].map((item, index) => (
            <div key={item}>
              <span>0{index + 1}</span>
              <h3>{item}</h3>
            </div>
          ))}
        </div>
      </section>

      <section id="gallery" className="gallery-section">
        <div>
          <p className="eyebrow">Life at Lokaraja</p>
          <h2>Moments that make progress visible.</h2>
        </div>
        <div className="gallery-grid">
          {slides.slice(0, 3).map((slide, index) => (
            <img key={slide._id || index} src={slide.resourceUrl} loading="lazy" alt="Academy life" />
          ))}
        </div>
      </section>

      <section id="exams" className="exam-section">
        <div>
          <FiCalendar />
          <p className="eyebrow">Upcoming online exam</p>
          <h2>Monthly practice assessment</h2>
          <p>Test your preparation, receive insight and know exactly what to do next.</p>
        </div>
        <button className="btn nav-login" onClick={() => setLoginOpen(true)}>
          Open exam portal <FiArrowRight />
        </button>
      </section>

      <section className="news-section">
        <div>
          <p className="eyebrow">Stay informed</p>
          <h2>Latest announcements</h2>
        </div>
        {['Admissions for the new MPSC batch are now open.', 'Weekly current-affairs workshop this Saturday.', 'New study materials are available in the portal.'].map((news, index) => (
          <article key={news}>
            <span>0{index + 1}</span>
            <p>{news}</p>
            <FiArrowRight />
          </article>
        ))}
      </section>

      <section id="contact" className="contact-section">
        <div>
          <p className="eyebrow">Contact us</p>
          <h2>Let’s build your next success story.</h2>
          <p>
            <FiMapPin /> Thikpurli, Maharashtra
          </p>
          <p>
            <FiUsers /> +91 00000 00000 · hello@lokarajaacademy.in
          </p>
        </div>
        <div className="map-card">
          <span>Lokaraja Career Academy</span>
          <small>Thikpurli, Maharashtra</small>
          <a href="https://maps.google.com/?q=Thikpurli,Maharashtra" target="_blank" rel="noreferrer">
            Open in Google Maps <FiArrowRight />
          </a>
        </div>
      </section>

      <footer>
        <div className="lokaraja-brand">
          <span className="brand-seal">ल</span>
          <span>
            Lokaraja <small>Career Academy</small>
          </span>
        </div>
        <p>लोकराजा करिअर अकादमी, थिकपुर्ली</p>
        <small>© {new Date().getFullYear()} Lokaraja Career Academy. All rights reserved.</small>
      </footer>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
