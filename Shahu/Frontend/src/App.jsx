import { RouterProvider } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FormPlaceholderAssistant } from './components/FormPlaceholderAssistant/FormPlaceholderAssistant';
import { router } from './navigation/AppRouter';

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <FormPlaceholderAssistant />
      <ToastContainer position="top-right" newestOnTop />
    </ErrorBoundary>
  );
}
