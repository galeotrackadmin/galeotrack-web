import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdminDashboard } from './_components/admin-dashboard'
import { DashboardLoading } from './_components/dashboard-loading'

export const metadata: Metadata = { title: 'Panel de revisión', robots: { index: false, follow: false } }

export default function AdminPage() {
  return <Suspense fallback={<DashboardLoading />}><AdminDashboard /></Suspense>
}
