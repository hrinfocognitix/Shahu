import { NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../config/routes';
import {
  FiAward,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiClipboard,
  FiFileText,
  FiGrid,
  FiImage,
  FiMonitor,
  FiTrash2,
  FiUser,
  FiUsers,
  FiVideo,
} from 'react-icons/fi';
import brandLogo from '../../assets/gs-by-anand-sir-icon.png';
import { toggleSidebar } from '../../redux/slices/uiSlice';

const links = [
  ['Dashboard', ROUTES.dashboard, FiGrid],
  ['Profile & Password', ROUTES.profile, FiUser],
  ['Students', ROUTES.students, FiUsers, ['admin', 'superadmin']],
  ['Teachers', ROUTES.teachers, FiUsers, ['admin', 'superadmin']],
  ['Subjects', ROUTES.subjects, FiClipboard],
  ['Syllabus', ROUTES.learning, FiClipboard],
  ['Courses', ROUTES.courses, FiBookOpen, ['admin', 'superadmin']],
  ['Video Lectures', ROUTES.videos, FiVideo],
  ['Achievement Wall', ROUTES.achievements, FiAward, ['admin', 'superadmin']],
  ['Calendar', ROUTES.calendar, FiCalendar],
  ['Online Exams', ROUTES.exams, FiMonitor],
  ['Student Results', ROUTES.results, FiAward],
  ['Notifications', ROUTES.notifications, FiBell],
  ['Reports', ROUTES.reports, FiFileText, ['admin', 'superadmin']],
  ['Splash Screen Upload', ROUTES.settings, FiImage, ['admin', 'superadmin']],
  ['Mobile API Capacity', ROUTES.mobileApiCapacity, FiMonitor, 'superadmin'],
  ['System Data', ROUTES.systemData, FiTrash2, 'superadmin'],
  ['Deleted Items', ROUTES.deletedRecords, FiTrash2, 'superadmin'],
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
  const dispatch = useDispatch();
  const open = useSelector((state) => state.ui.sidebarOpen);
  const user = useSelector((state) => state.auth.user);
  const { t } = useTranslation();

  return (
    <aside className={`sidebar ${open ? 'open' : 'collapsed'}`}>
      <div className="sidebar-brand">
        <img src={brandLogo} alt="GS BY Anand Sir" />
        <div>
          <h1>GS BY</h1>
          <span>Anand Sir</span>
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
            <NavLink key={to} to={to} onClick={() => { if (window.matchMedia('(max-width: 760px)').matches) dispatch(toggleSidebar()); }}>
              <Icon />
              <span>{t(label, label)}</span>
            </NavLink>
          ))}
      </nav>
    </aside>
  );
}
