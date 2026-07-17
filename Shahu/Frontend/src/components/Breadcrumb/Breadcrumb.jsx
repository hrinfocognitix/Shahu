import { useLocation } from 'react-router-dom';

export function Breadcrumb() {
  const location = useLocation();
  const label = location.pathname === '/' ? 'Dashboard' : location.pathname.slice(1);
  return <div className="breadcrumb">{label}</div>;
}
