import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute/ProtectedRoute';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Dashboard } from '../pages/Dashboard/Dashboard';
import { Login } from '../pages/Login/Login';
import { NotFound } from '../pages/NotFound/NotFound';
import { Notifications } from '../pages/Notifications/Notifications';
import { Profile } from '../pages/Profile/Profile';
import { Reports } from '../pages/Reports/Reports';
import { Settings } from '../pages/Settings/Settings';
import { Users } from '../pages/Users/Users';
import { Home } from '../pages/Home/Home';
import { CourseDetail } from '../pages/CourseDetail/CourseDetail';
import { Management } from '../pages/Management/Management';
import { ROUTES } from '../config/routes';

export const router = createBrowserRouter([
  { path: ROUTES.home, element: <Home /> },
  { path: ROUTES.courseDetail, element: <CourseDetail /> },
  {
    element: <AuthLayout />,
    children: [{ path: ROUTES.login, element: <Login /> }]
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: ROUTES.dashboard, element: <Dashboard /> },
          { path: ROUTES.profile, element: <Profile /> },
          { path: ROUTES.users, element: <Users /> },
          { path: ROUTES.settings, element: <Settings /> },
          { path: ROUTES.reports, element: <Reports /> },
          { path: ROUTES.notifications, element: <Notifications /> }
          ,{ path: ROUTES.students, element: <Management resource="students" /> }
          ,{ path: ROUTES.teachers, element: <Management resource="teachers" /> }
          ,{ path: ROUTES.courses, element: <Management resource="courses" /> }
          ,{ path: ROUTES.paymentAccounts, element: <Management resource="payment-accounts" /> }
          ,{ path: ROUTES.coursePurchases, element: <Management resource="course-purchases" /> }
          ,{ path: ROUTES.subjects, element: <Management resource="subjects" /> }
          ,{ path: ROUTES.syllabus, element: <Management resource="syllabus" /> }
          ,{ path: ROUTES.materials, element: <Management resource="materials" /> }
          ,{ path: ROUTES.notes, element: <Management resource="notes" /> }
          ,{ path: ROUTES.questionPapers, element: <Management resource="question-papers" /> }
          ,{ path: ROUTES.videos, element: <Management resource="videos" /> }
          ,{ path: ROUTES.assignments, element: <Management resource="assignments" /> }
          ,{ path: ROUTES.exams, element: <Management resource="exams" /> }
          ,{ path: ROUTES.results, element: <Management resource="results" /> }
          ,{ path: ROUTES.marks, element: <Management resource="marks" /> }
          ,{ path: ROUTES.attendance, element: <Management resource="attendance" /> }
          ,{ path: ROUTES.calendar, element: <Management resource="calendar" /> }
          ,{ path: ROUTES.announcements, element: <Management resource="announcements" /> }
          ,{ path: ROUTES.gallery, element: <Management resource="gallery" /> }
        ]
      }
    ]
  },
  { path: '*', element: <NotFound /> }
]);
