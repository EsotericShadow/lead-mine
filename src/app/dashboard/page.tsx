import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Render the legacy viewer within the secure dashboard
  return (
    <div style={{ height: '100vh', width: '100vw', background: '#f8f9fa' }}>
      <iframe
        src="/legacy-viewer/index.html"
        title="Legacy Business Viewer"
        style={{ border: 'none', width: '100%', height: '100%' }}
      />
    </div>
  );
}
