import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ToastContainer } from '../ui/Toast';
import { LoadingScreen } from '../ui/LoadingScreen';

export function AppLayout() {
  return (
    <>
      <LoadingScreen />
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: 'var(--spacing-md) 0',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        fontSize: '0.8rem',
      }}>
        4Dot &copy; {new Date().getFullYear()}
      </footer>
      <ToastContainer />
    </>
  );
}
