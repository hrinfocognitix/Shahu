import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiArrowRight,
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
import founderLogo from '../../assets/lokaraja-founder.png';

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

const homeText = {
  en: { home: 'Home', about: 'About', courses: 'Courses', teachers: 'Teachers', gallery: 'Gallery', exams: 'Online Exams', materials: 'Study Materials', contact: 'Contact', login: 'Login', academyWall: 'Academy wall', achievements: 'Achievement highlights', featured: 'Featured highlight', programs: 'Our programs', availableCourses: 'Available courses', viewProgram: 'View program', explore: 'Explore our courses', begin: 'A place to begin', ambition: 'Ambition deserves a clear path.', intro: 'Lokaraja Career Academy helps learners turn effort into progress through rigorous teaching, personal mentorship and a study ecosystem built for consistency.', trust: 'years of trust', guided: 'learners guided', satisfaction: 'satisfaction', director: 'A note from our director', quote: '“The right guidance can transform a student’s confidence into achievement.”', mentors: 'Our mentors', mentorsTitle: 'Teachers who stay invested.', academyLife: 'Life at Lokaraja', moments: 'Moments that make progress visible.', upcoming: 'Upcoming online exam', assessment: 'Monthly practice assessment', examCopy: 'Test your preparation, receive insight and know exactly what to do next.', openExam: 'Open exam portal', informed: 'Stay informed', latest: 'Latest announcements', news: ['Admissions for the new MPSC batch are now open.', 'Weekly current-affairs workshop this Saturday.', 'New study materials are available in the portal.'], contactUs: 'Contact us', contactTitle: 'Let’s build your next success story.', address: 'Thikpurli, Maharashtra', maps: 'Open in Google Maps', rights: 'All rights reserved.' },
  mr: { home: 'मुख्यपृष्ठ', about: 'आमच्याबद्दल', courses: 'कोर्स', teachers: 'शिक्षक', gallery: 'गॅलरी', exams: 'ऑनलाइन परीक्षा', materials: 'अभ्यास साहित्य', contact: 'संपर्क', login: 'लॉगिन', academyWall: 'अकादमी वॉल', achievements: 'यशोगाथा', featured: 'विशेष यश', programs: 'आमचे कोर्स', availableCourses: 'उपलब्ध कोर्स', viewProgram: 'कोर्स पहा', explore: 'आमचे कोर्स पहा', begin: 'सुरुवातीचे योग्य ठिकाण', ambition: 'महत्त्वाकांक्षेला स्पष्ट दिशा हवी.', intro: 'लोकराजा करिअर अकादमी कठोर अध्यापन, वैयक्तिक मार्गदर्शन आणि सातत्यपूर्ण अभ्यास व्यवस्थेद्वारे विद्यार्थ्यांच्या प्रयत्नांना प्रगतीत बदलते.', trust: 'वर्षांचा विश्वास', guided: 'विद्यार्थ्यांना मार्गदर्शन', satisfaction: 'समाधान', director: 'संचालकांचा संदेश', quote: '“योग्य मार्गदर्शन विद्यार्थ्याचा आत्मविश्वास यशात बदलू शकते.”', mentors: 'आमचे मार्गदर्शक', mentorsTitle: 'विद्यार्थ्यांसोबत कायम उभे राहणारे शिक्षक.', academyLife: 'लोकराजामधील क्षण', moments: 'प्रगती दर्शवणारे अविस्मरणीय क्षण.', upcoming: 'आगामी ऑनलाइन परीक्षा', assessment: 'मासिक सराव चाचणी', examCopy: 'तुमच्या तयारीची चाचणी घ्या, विश्लेषण मिळवा आणि पुढील दिशा ठरवा.', openExam: 'परीक्षा पोर्टल उघडा', informed: 'अपडेट रहा', latest: 'नवीन सूचना', news: ['नवीन MPSC बॅचसाठी प्रवेश सुरू आहेत.', 'या शनिवारी साप्ताहिक चालू घडामोडी कार्यशाळा.', 'पोर्टलमध्ये नवीन अभ्यास साहित्य उपलब्ध आहे.'], contactUs: 'आमच्याशी संपर्क', contactTitle: 'तुमच्या पुढील यशाची सुरुवात करूया.', address: 'थिकपुर्ली, महाराष्ट्र', maps: 'Google Maps मध्ये उघडा', rights: 'सर्व हक्क राखीव.' }
};

function resolveAssetUrl(path) {
  const assetBase = environment.apiBaseUrl.replace(/\/api\/v1$/, '');
  if (!path) return `${assetBase}/uploads/course-default-poster.png`;
  if (!path.startsWith('http')) return `${assetBase}${path}`;
  return path.replace(/^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2):5001/i, assetBase);
}

export function Home() {
  const [language, setLanguage] = useState('en');
  const text = homeText[language];
  const [loginOpen, setLoginOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [heroCurrent, setHeroCurrent] = useState(0);
  const [gallery, setGallery] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    apiClient
      .get('/app/catalog')
      .then(response => {
        const catalog = response.data.data || {};
        setAchievements(catalog.achievements || []);
        setCourses(catalog.courses || []);
      })
      .catch(() => {
        setAchievements([]);
        setCourses([]);
      });
  }, []);

  useEffect(() => {
    apiClient
      .get('/gallery', { params: { limit: 5 } })
      .then(response => setGallery((response.data.data || []).filter(item => item.resourceUrl).slice(0, 5)))
      .catch(() => {});
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
  const achievementSlides = useMemo(
    () =>
      achievements.flatMap(achievement => {
        if (achievement.media?.length) {
          return achievement.media.map((media, index) => ({
            ...achievement,
            _id: `${achievement._id || 'achievement'}-${index}`,
            resourceUrl: resolveAssetUrl(media.url),
            mediaType: media.type || (media.url?.match(/\.(mp4|webm|mov)(\?|$)/i) ? 'video' : 'image')
          }));
        }

        const resourceUrl = achievement.videoUrl || achievement.imageUrl || achievement.resourceUrl;
        if (!resourceUrl) return [];
        return [{
          ...achievement,
          resourceUrl: resolveAssetUrl(resourceUrl),
          mediaType: achievement.videoUrl || resourceUrl.match(/\.(mp4|webm|mov)(\?|$)/i) ? 'video' : 'image'
        }];
      }),
    [achievements]
  );
  const heroSlides = useMemo(() => {
    if (gallery.length) return gallery;
    if (courseSlides.length) return courseSlides;
    return fallbackSlides;
  }, [courseSlides, gallery]);
  const wallSlides = achievementSlides.length ? achievementSlides : heroSlides;
  const wallCurrent = wallSlides.length ? current % wallSlides.length : 0;

  useEffect(() => {
    if (wallSlides.length <= 1 || wallSlides[wallCurrent]?.mediaType === 'video') return undefined;
    const timer = setInterval(() => setCurrent(index => (index + 1) % wallSlides.length), 3500);
    return () => clearInterval(timer);
  }, [wallCurrent, wallSlides]);

  useEffect(() => {
    if (heroSlides.length <= 1) return undefined;
    const timer = setInterval(() => setHeroCurrent(index => (index + 1) % heroSlides.length), 4500);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const changeSlide = direction => setCurrent(index => (index + direction + wallSlides.length) % wallSlides.length);
  const changeHeroSlide = direction => setHeroCurrent(index => (index + direction + heroSlides.length) % heroSlides.length);
  const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <main className="lokaraja">
      <header className="lokaraja-nav">
        <Link to="/" className="lokaraja-brand">
          <img className="brand-logo" src={founderLogo} alt="Lokaraja Career Academy" />
          <span>
            Lokaraja <small>Career Academy</small>
          </span>
        </Link>
        <nav>
          {[
            [text.home, 'home'],
            [text.about, 'about'],
            [text.courses, 'courses'],
            [text.teachers, 'teachers'],
            [text.gallery, 'gallery'],
            [text.exams, 'exams'],
            [text.materials, 'courses'],
            [text.contact, 'contact']
          ].map(([label, id]) => (
            <button key={label} type="button" onClick={() => jump(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="website-language" aria-label="Language"><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button><button className={language === 'mr' ? 'active' : ''} onClick={() => setLanguage('mr')}>मराठी</button></div>
        <button className="btn nav-login" type="button" onClick={() => setLoginOpen(true)}>
          {text.login} <FiArrowRight />
        </button>
      </header>

      <section id="home" className="hero-slider">
        {heroSlides.map((slide, index) => (
          <motion.div
            key={slide._id || slide.resourceUrl}
            className="hero-slide"
            initial={false}
            animate={{ opacity: index === heroCurrent ? 1 : 0, scale: index === heroCurrent ? 1 : 1.04 }}
            transition={{ duration: 0.8 }}
            aria-hidden={index !== heroCurrent}>
            <img src={slide.resourceUrl} alt={slide.title || 'Lokaraja academy students'} loading={index ? 'lazy' : 'eager'} />
            <div className="hero-shade" />
          </motion.div>
        ))}
        <div className="hero-copy">
          <motion.p key={`tag-${heroCurrent}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            लोकराजा करिअर अकादमी, थिकपुर्ली
          </motion.p>
          <motion.h1 key={`title-${heroCurrent}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            {heroSlides[heroCurrent]?.title || 'Learn with purpose.'}
          </motion.h1>
          <span>{heroSlides[heroCurrent]?.description || 'Lokaraja Career Academy, Thikpurli'}</span>
          <button className="btn hero-button" onClick={() => jump('courses')}>
            {text.explore} <FiArrowRight />
          </button>
        </div>
        <div className="slider-controls">
          <button aria-label="Previous slide" onClick={() => changeHeroSlide(-1)}>
            <FiChevronLeft />
          </button>
          <div className="slider-dots">
            {heroSlides.map((slide, index) => (
              <button
                aria-label={`Show slide ${index + 1}`}
                className={index === heroCurrent ? 'active' : ''}
                onClick={() => setHeroCurrent(index)}
                key={slide._id || index}
              />
            ))}
          </div>
          <button aria-label="Next slide" onClick={() => changeHeroSlide(1)}>
            <FiChevronRight />
          </button>
        </div>
      </section>

      <section className="achievement-wall" aria-label="Achievement highlights">
        <div className="achievement-wall-heading">
          <div>
            <p className="eyebrow">{text.academyWall}</p>
            <h2>{text.achievements}</h2>
          </div>
          <span>{wallSlides.length ? `${wallCurrent + 1} / ${wallSlides.length}` : ''}</span>
        </div>
        <div className="achievement-carousel">
          {wallSlides.map((slide, index) => (
            <article
              className={`achievement-card ${index === wallCurrent ? 'active' : ''}`}
              key={slide._id || `${slide.resourceUrl}-${index}`}
              aria-hidden={index !== wallCurrent}>
              {slide.mediaType === 'video' ? (
                <video src={slide.resourceUrl} controls loop playsInline preload="metadata" />
              ) : (
                <img
                  src={slide.resourceUrl}
                  alt={slide.title || `Achievement highlight ${index + 1}`}
                  loading={index ? 'lazy' : 'eager'}
                  onError={event => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = resolveAssetUrl('/uploads/course-default-poster.png');
                  }}
                />
              )}
              <div className="achievement-card-shade" />
              <div className="achievement-card-copy">
                <p>{text.featured}</p>
                <h3>{slide.title || `Achievement highlight ${index + 1}`}</h3>
                {slide.description ? <span>{slide.description}</span> : null}
              </div>
            </article>
          ))}
          <div className="achievement-controls">
            <button type="button" aria-label="Previous achievement" onClick={() => changeSlide(-1)}><FiChevronLeft /></button>
            <div className="slider-dots">
              {wallSlides.map((slide, index) => (
                <button type="button" aria-label={`Show achievement ${index + 1}`} className={index === wallCurrent ? 'active' : ''} onClick={() => setCurrent(index)} key={slide._id || index} />
              ))}
            </div>
            <button type="button" aria-label="Next achievement" onClick={() => changeSlide(1)}><FiChevronRight /></button>
          </div>
        </div>
      </section>

      <section id="courses" className="content-section">
        <p className="eyebrow">{text.programs}</p>
        <h2>{text.availableCourses}</h2>
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
              <div className="course-price-display">
                <b>₹ {Number(course.fees || 0).toLocaleString('en-IN')}</b>
                {course.actualPrice && Number(course.actualPrice) > Number(course.fees || 0) ? <del>₹ {Number(course.actualPrice).toLocaleString('en-IN')}</del> : null}
                {course.discountPercent ? <small>{course.discountPercent}% OFF</small> : null}
              </div>
              {(course.discountPercent || course.offerText) ? <div className="course-offer-highlight"><b>{course.discountPercent ? `${course.discountPercent}% OFF` : 'SPECIAL OFFER'}</b>{course.offerText ? <small>{course.offerText}</small> : null}</div> : null}
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
                  <FiTag /> {course.actualPrice ? <del>Rs. {Number(course.actualPrice).toLocaleString('en-IN')}</del> : null} Rs. {Number(course.fees || 0).toLocaleString('en-IN')}
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
                {text.viewProgram} <FiArrowRight />
              </Link>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="about" className="intro-section">
        <div>
          <p className="eyebrow">{text.begin}</p>
          <h2>{text.ambition}</h2>
        </div>
        <div>
          <p>
            {text.intro}
          </p>
          <div className="intro-stats">
            <span><b>12+</b> {text.trust}</span>
            <span><b>2,500+</b> {text.guided}</span>
            <span><b>95%</b> {text.satisfaction}</span>
          </div>
        </div>
      </section>

      <section className="director-section">
        <div className="director-art">
          <img src={founderLogo} alt="Lokaraja Career Academy founder" />
        </div>
        <div>
          <p className="eyebrow">{text.director}</p>
          <h2>{text.quote}</h2>
          <p>Every learner comes with a different story. Our job is to make their next chapter stronger, calmer and full of possibility.</p>
          <strong>— Director, Lokaraja Career Academy</strong>
        </div>
      </section>

      <section id="teachers" className="teachers-section">
        <p className="eyebrow">{text.mentors}</p>
        <h2>{text.mentorsTitle}</h2>
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
          <p className="eyebrow">{text.academyLife}</p>
          <h2>{text.moments}</h2>
        </div>
        <div className="gallery-grid">
          {heroSlides.slice(0, 3).map((slide, index) => (
            <img key={slide._id || index} src={slide.resourceUrl} loading="lazy" alt="Academy life" />
          ))}
        </div>
      </section>

      <section id="exams" className="exam-section">
        <div>
          <FiCalendar />
          <p className="eyebrow">{text.upcoming}</p>
          <h2>{text.assessment}</h2>
          <p>{text.examCopy}</p>
        </div>
        <button className="btn nav-login" onClick={() => setLoginOpen(true)}>
          {text.openExam} <FiArrowRight />
        </button>
      </section>

      <section className="news-section">
        <div>
          <p className="eyebrow">{text.informed}</p>
          <h2>{text.latest}</h2>
        </div>
        {text.news.map((news, index) => (
          <article key={news}>
            <span>0{index + 1}</span>
            <p>{news}</p>
            <FiArrowRight />
          </article>
        ))}
      </section>

      <section id="contact" className="contact-section">
        <div>
          <p className="eyebrow">{text.contactUs}</p>
          <h2>{text.contactTitle}</h2>
          <p>
            <FiMapPin /> {text.address}
          </p>
          <p>
            <FiUsers /> +91 00000 00000 · hello@lokarajaacademy.in
          </p>
        </div>
        <div className="map-card">
          <span>Lokaraja Career Academy</span>
          <small>{text.address}</small>
          <a href="https://maps.google.com/?q=Thikpurli,Maharashtra" target="_blank" rel="noreferrer">
            {text.maps} <FiArrowRight />
          </a>
        </div>
      </section>

      <footer>
        <div className="lokaraja-brand">
          <img className="brand-logo" src={founderLogo} alt="Lokaraja Career Academy" />
          <span>
            Lokaraja <small>Career Academy</small>
          </span>
        </div>
        <p>लोकराजा करिअर अकादमी, थिकपुर्ली</p>
        <small>© {new Date().getFullYear()} Lokaraja Career Academy. {text.rights}</small>
      </footer>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
