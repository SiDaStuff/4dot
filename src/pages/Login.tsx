import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';

export function Login() {
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 420, paddingTop: '3rem' }}>
        <LoginForm />
      </div>
    </div>
  );
}