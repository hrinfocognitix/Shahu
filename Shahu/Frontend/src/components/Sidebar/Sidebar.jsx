import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../config/routes';
import { FiAward, FiBell, FiBookOpen, FiCalendar, FiClipboard, FiCreditCard, FiFileText, FiGrid, FiImage, FiMonitor, FiSettings, FiUsers, FiVideo } from 'react-icons/fi';
import founderLogo from '../../assets/lokaraja-founder.png';

const links = [
  ['Dashboard', ROUTES.dashboard, FiGrid], ['Users', ROUTES.users, FiUsers, 'superadmin'], ['Students', ROUTES.students, FiUsers], ['Teachers', ROUTES.teachers, FiUsers], ['Courses', ROUTES.courses, FiBookOpen], ['Subjects', ROUTES.subjects, FiClipboard], ['Payment Accounts', ROUTES.paymentAccounts, FiCreditCard], ['Course Purchases', ROUTES.coursePurchases, FiCreditCard], ['Syllabus', ROUTES.syllabus, FiFileText], ['Study Materials', ROUTES.materials, FiFileText], ['Notes', ROUTES.notes, FiFileText], ['Question Papers', ROUTES.questionPapers, FiClipboard], ['Video Lectures', ROUTES.videos, FiVideo], ['Gallery', ROUTES.gallery, FiImage], ['Calendar', ROUTES.calendar, FiCalendar], ['Online Exams', ROUTES.exams, FiMonitor], ['Results', ROUTES.results, FiAward], ['Attendance', ROUTES.attendance, FiClipboard], ['Notifications', ROUTES.notifications, FiBell], ['Reports', ROUTES.reports, FiFileText], ['Splash Screen Upload', ROUTES.settings, FiImage], ['Settings', ROUTES.settings, FiSettings]
];

export function Sidebar() {
  const open = useSelector(state => state.ui.sidebarOpen);
  const user = useSelector(state => state.auth.user);
  const { t } = useTranslation();

  return (
    <aside className={`sidebar ${open ? 'open' : 'collapsed'}`}>
      <div className="sidebar-brand"><img src={founderLogo} alt="Lokaraja Career Academy" /><div><h1>लोकराजा</h1><span>करिअर अकादमी, थिकपुर्ली</span></div></div>
      <p className="sidebar-role">{user?.role || 'admin'} workspace</p>
      <nav>
        {links.filter(([, , , role]) => !role || user?.role === role).map(([label, to, Icon]) => (
          <NavLink key={to} to={to}>
            <Icon /><span>{t(label, label)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
