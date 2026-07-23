import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TourButton } from './TourButton';
import './Layout.css';

export function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="layout-main">
        <Outlet />
      </main>
      <TourButton />
    </div>
  );
}
