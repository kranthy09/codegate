import { getServerUser } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser()
  const staffRoles = ['admin', 'manager', 'interviewer']
  if (!user || !staffRoles.includes(user.role)) redirect('/')
  return <>{children}</>
}
