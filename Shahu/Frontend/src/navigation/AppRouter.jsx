import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute/ProtectedRoute';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Dashboard } from '../pages/Dashboard/Dashboard';
import { SuperAdminDashboard } from '../pages/SuperAdminDashboard/SuperAdminDashboard';
import { NotFound } from '../pages/NotFound/NotFound';
import { Notifications } from '../pages/Notifications/Notifications';
import { Profile } from '../pages/Profile/Profile';
import { Reports } from '../pages/Reports/Reports';
import { Settings } from '../pages/Settings/Settings';
import { Users } from '../pages/Users/Users';
import { Home } from '../pages/Home/Home';
import { CourseDetail } from '../pages/CourseDetail/CourseDetail';
import { Management } from '../pages/Management/Management';
import { Students } from '../pages/Students/Students';
import { Purchases } from '../pages/Purchases/Purchases';
import { Teachers } from '../pages/Teachers/Teachers';
import { Subjects } from '../pages/Subjects/Subjects';
import { Learning } from '../pages/Learning/Learning';
import { StudentWorkspace } from '../pages/StudentWorkspace/StudentWorkspace';
import { AuditLogs } from '../pages/AuditLogs/AuditLogs';
import { DeletedRecords } from '../pages/DeletedRecords/DeletedRecords';
import { MobileApiCapacity } from '../pages/MobileApiCapacity/MobileApiCapacity';
import { Results } from '../pages/Results/Results';
import { Calendar } from '../pages/Calendar/Calendar';
import { ROUTES } from '../config/routes';
import { useSelector } from 'react-redux';

function DashboardEntry() {
  const user = useSelector((state) => state.auth.user);
  return user?.role === 'superadmin' ? <SuperAdminDashboard /> : <Dashboard />;
}

export const router = createBrowserRouter([
  { path: ROUTES.home, element: <Home /> },
  { path: ROUTES.courseDetail, element: <CourseDetail /> },
  {
    element: <AuthLayout />,
    children: [{ path: ROUTES.login, element: <Navigate to={ROUTES.home} replace /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: ROUTES.dashboard, element: <DashboardEntry /> },
          { path: ROUTES.profile, element: <Profile /> },
          { path: ROUTES.users, element: <Users /> },
          { path: ROUTES.settings, element: <Settings /> },
          { path: ROUTES.mobileApiCapacity, element: <MobileApiCapacity /> },
          { path: ROUTES.reports, element: <Reports /> },
          { path: ROUTES.notifications, element: <Notifications /> },
          { path: ROUTES.students, element: <Students /> },
          { path: ROUTES.teachers, element: <Teachers /> },
          { path: ROUTES.courses, element: <Management resource="courses" /> },
          { path: ROUTES.paymentAccounts, element: <Management resource="payment-accounts" /> },
          { path: ROUTES.coursePurchases, element: <Purchases /> },
          { path: ROUTES.auditLogs, element: <AuditLogs /> },
          { path: ROUTES.deletedRecords, element: <DeletedRecords /> },
          { path: ROUTES.subjects, element: <Subjects /> },
          { path: ROUTES.syllabus, element: <Learning /> },
          { path: ROUTES.learning, element: <Learning /> },
          { path: ROUTES.studentHome, element: <StudentWorkspace mode="home" /> },
          { path: ROUTES.studentCourses, element: <StudentWorkspace mode="courses" /> },
          { path: ROUTES.studentSyllabus, element: <StudentWorkspace mode="syllabus" /> },
          { path: ROUTES.studentNotes, element: <StudentWorkspace mode="notes" /> },
          { path: ROUTES.studentPapers, element: <StudentWorkspace mode="papers" /> },
          { path: ROUTES.studentTests, element: <StudentWorkspace mode="tests" /> },
          { path: ROUTES.studentLectures, element: <StudentWorkspace mode="lectures" /> },
          { path: ROUTES.studentProfile, element: <StudentWorkspace mode="profile" /> },
          { path: ROUTES.materials, element: <Learning /> },
          { path: ROUTES.notes, element: <Learning /> },
          { path: ROUTES.questionPapers, element: <Learning /> },
          { path: ROUTES.videos, element: <Management resource="videos" /> },
          { path: ROUTES.assignments, element: <Management resource="assignments" /> },
          { path: ROUTES.exams, element: <Management resource="exams" /> },
          { path: ROUTES.results, element: <Results /> },
          { path: ROUTES.marks, element: <Management resource="marks" /> },
          { path: ROUTES.attendance, element: <Management resource="attendance" /> },
          { path: ROUTES.calendar, element: <Calendar /> },
          { path: ROUTES.announcements, element: <Management resource="announcements" /> },
          { path: ROUTES.gallery, element: <Management resource="gallery" /> },
          { path: ROUTES.achievements, element: <Management resource="achievements" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
