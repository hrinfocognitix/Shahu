import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ROUTES } from '../../config/routes';

export function ProtectedRoute() {
  const isAuthenticated = Boolean(useSelector(state => state.auth.accessToken));
  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.home} replace />;
}
