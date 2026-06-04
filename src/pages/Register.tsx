import { RegisterForm } from '../components/auth/RegisterForm';

export function Register() {
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 420, paddingTop: '3rem' }}>
        <RegisterForm />
      </div>
    </div>
  );
}