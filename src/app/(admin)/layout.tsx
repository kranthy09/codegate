import { getServerUser } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser()
  if (user?.role !== 'admin') redirect('/dashboard')
  return <>{children}</>
}
