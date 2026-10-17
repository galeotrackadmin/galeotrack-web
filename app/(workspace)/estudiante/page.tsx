import type { Metadata } from 'next'
import { ModuleDashboard } from '@/components/community/module-dashboard'
export const metadata: Metadata = { title: 'Espacio estudiante' }
export default function StudentPage() { return <ModuleDashboard mode="student" /> }
