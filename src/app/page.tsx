import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/config'

export default async function Home() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  redirect('/dashboard')
}
