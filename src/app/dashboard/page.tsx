import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Dashboard from '@/components/Dashboard';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }

  return (
    <Dashboard 
      user={{
        id: user.userId,
        username: user.username,
      }} 
    />
  );
}
