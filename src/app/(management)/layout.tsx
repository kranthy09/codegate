import { getServerUser } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser()
  if (!user || !['admin', 'manager'].includes(user.role)) redirect('/dashboard')
  return <>{children}</>
}
