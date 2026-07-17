import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';

export function NotFound() {
  return (
    <main className="not-found">
      <h1>404</h1>
      <Link to={ROUTES.dashboard}>Back to dashboard</Link>
    </main>
  );
}
