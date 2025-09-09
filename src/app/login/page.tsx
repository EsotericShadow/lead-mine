import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';

export default async function LoginPage() {
  // Check if user is already authenticated
  const user = await getCurrentUser();
  
  if (user) {
    redirect('/dashboard');
  }

  return <LoginForm />;
}
