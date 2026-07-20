import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ROUTES } from '../../config/routes';

export function ProtectedRoute() {
  const { accessToken, user } = useSelector((state) => state.auth);
  const location = useLocation();
  if (!accessToken) return <Navigate to={ROUTES.home} replace />;
  if (user?.mustChangePassword && location.pathname !== ROUTES.profile) {
    return <Navigate to={ROUTES.profile} replace />;
  }
  if (
    user?.role === 'student' &&
    !location.pathname.startsWith('/student/') &&
    location.pathname !== ROUTES.profile
  ) {
    return <Navigate to={ROUTES.studentHome} replace />;
  }
  return <Outlet />;
}
