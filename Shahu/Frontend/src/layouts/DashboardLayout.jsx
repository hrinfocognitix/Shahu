import { Outlet } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb/Breadcrumb';
import { Footer } from '../components/Footer/Footer';
import { Header } from '../components/Header/Header';
import { Sidebar } from '../components/Sidebar/Sidebar';

export function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="workspace">
        <Header />
        <main className="content">
          <Breadcrumb />
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
