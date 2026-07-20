import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../config/routes';
import {
  FiAward,
  FiActivity,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiClipboard,
  FiCreditCard,
  FiFileText,
  FiGrid,
  FiImage,
  FiMonitor,
  FiSettings,
  FiUser,
  FiUsers,
  FiVideo,
} from 'react-icons/fi';
import founderLogo from '../../assets/lokaraja-founder.png';

const links = [
  ['Dashboard', ROUTES.dashboard, FiGrid],
  ['Users', ROUTES.users, FiUsers, 'superadmin'],
  ['Students', ROUTES.students, FiUsers, ['admin', 'superadmin']],
  ['Teachers', ROUTES.teachers, FiUsers, ['admin', 'superadmin']],
  ['Courses', ROUTES.courses, FiBookOpen, ['admin', 'superadmin']],
  ['Subjects', ROUTES.subjects, FiClipboard],
  ['Payment Accounts', ROUTES.paymentAccounts, FiCreditCard, ['admin', 'superadmin']],
  ['Course Purchases', ROUTES.coursePurchases, FiCreditCard, ['admin', 'superadmin']],
  ['Syllabus & Learning', ROUTES.learning, FiFileText],
  ['Video Lectures', ROUTES.videos, FiVideo],
  ['Achievement Wall', ROUTES.achievements, FiAward, ['admin', 'superadmin']],
  ['Gallery', ROUTES.gallery, FiImage],
  ['Calendar', ROUTES.calendar, FiCalendar],
  ['Online Exams', ROUTES.exams, FiMonitor],
  ['Results', ROUTES.results, FiAward],
  ['Attendance', ROUTES.attendance, FiClipboard],
  ['Notifications', ROUTES.notifications, FiBell],
  ['Reports', ROUTES.reports, FiFileText, ['admin', 'superadmin']],
  ['Audit Logs', ROUTES.auditLogs, FiActivity, 'superadmin'],
  ['Splash Screen Upload', ROUTES.settings, FiImage, ['admin', 'superadmin']],
  ['Settings', ROUTES.settings, FiSettings, ['admin', 'superadmin']],
];
const studentLinks = [
  ['Home', ROUTES.studentHome, FiGrid],
  ['Courses', ROUTES.studentCourses, FiBookOpen],
  ['Syllabus', ROUTES.studentSyllabus, FiClipboard],
  ['Notes', ROUTES.studentNotes, FiFileText],
  ['Paper', ROUTES.studentPapers, FiFileText],
  ['Test', ROUTES.studentTests, FiMonitor],
  ['Lectures', ROUTES.studentLectures, FiVideo],
  ['Profile & Payments', ROUTES.studentProfile, FiUser],
];

export function Sidebar() {
  const open = useSelector((state) => state.ui.sidebarOpen);
  const user = useSelector((state) => state.auth.user);
  const { t } = useTranslation();

  return (
    <aside className={`sidebar ${open ? 'open' : 'collapsed'}`}>
      <div className="sidebar-brand">
        <img src={founderLogo} alt="Lokaraja Career Academy" />
        <div>
          <h1>लोकराजा</h1>
          <span>करिअर अकादमी, थिकपुर्ली</span>
        </div>
      </div>
      <p className="sidebar-role">{t('workspace', { role: user?.role || 'admin' })}</p>
      <nav>
        {(user?.role === 'student' ? studentLinks : links)
          .filter(
            ([, , , role]) =>
              !role || (Array.isArray(role) ? role.includes(user?.role) : user?.role === role)
          )
          .map(([label, to, Icon]) => (
            <NavLink key={to} to={to}>
              <Icon />
              <span>{t(label, label)}</span>
            </NavLink>
          ))}
      </nav>
    </aside>
  );
}
