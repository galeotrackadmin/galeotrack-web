'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdminAccessError, getReviewer, loadDashboard, reviewSighting } from '@/lib/admin'
import { supabase } from '@/lib/supabase-client'
import { dashboardQueryUrl, parseDashboardQuery } from '@/lib/dashboard-query'
import type { DashboardData, Reviewer, ReviewStatus, SightingFilter } from '@/lib/types'

type Query = { filter: SightingFilter; page: number; revision: number }
type Notice = { kind: 'success' | 'error' | 'info'; message: string }

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

export function useAdminDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { filter, page } = parseDashboardQuery(searchParams)
  const [revision, setRevision] = useState(0)
  const [access, setAccess] = useState<{
    reviewer: Reviewer | null
    loading: boolean
    error: string
  }>({ reviewer: null, loading: true, error: '' })
  const [accessAttempt, setAccessAttempt] = useState(0)
  const query = useMemo<Query>(() => ({ filter, page, revision }), [filter, page, revision])
  const [result, setResult] = useState<{
    query: Query | null
    data: DashboardData | null
    error: string
  }>({ query: null, data: null, error: '' })
  const [notice, setNotice] = useState<Notice | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const actionInFlight = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    let active = true

    async function checkAccess() {
      try {
        const reviewer = await getReviewer(supabase)
        if (active) {
          setAccess({ reviewer, loading: false, error: '' })
        }
      } catch (error) {
        if (!active) return
        if (error instanceof AdminAccessError) {
          router.replace('/login')
          return
        }
        setAccess({ reviewer: null, loading: false, error: errorMessage(error) })
      }
    }

    void checkAccess()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) {
        active = false
        setAccess({ reviewer: null, loading: true, error: '' })
        router.replace('/login')
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [router, accessAttempt])

  useEffect(() => {
    if (!access.reviewer) return
    let active = true

    async function fetchDashboard() {
      try {
        const data = await loadDashboard(supabase, query.filter, query.page)
        if (active) {
          setResult({ query, data, error: '' })
          if (data.page !== query.page) router.replace(dashboardQueryUrl(query.filter, data.page), { scroll: false })
        }
      } catch (error) {
        if (active) setResult({ query, data: null, error: errorMessage(error) })
      }
    }

    void fetchDashboard()
    // Ignora respuestas anteriores al cambiar filtros, página o desmontar.
    return () => { active = false }
  }, [access.reviewer, query, router])

  const loadingData = result.query !== query
  const busy = reviewingId !== null || loggingOut

  function retryAccess() {
    setAccess({ reviewer: null, loading: true, error: '' })
    setAccessAttempt((attempt) => attempt + 1)
  }

  function refresh() {
    setRevision((current) => current + 1)
  }

  function changeFilter(filter: SightingFilter) {
    if (actionInFlight.current) return
    setNotice(null)
    router.push(dashboardQueryUrl(filter, 1), { scroll: false })
  }

  function changePage(page: number) {
    if (actionInFlight.current || loadingData || !result.data) return
    const totalPages = result.data.totalPages
    setNotice(null)
    router.push(dashboardQueryUrl(query.filter, Math.min(Math.max(1, page), totalPages)), { scroll: false })
  }

  async function review(id: string, status: ReviewStatus) {
    if (actionInFlight.current || loadingData || !access.reviewer) return
    actionInFlight.current = true
    setReviewingId(id)
    setNotice(null)

    try {
      const updated = await reviewSighting(supabase, id, status)
      if (!mounted.current) return
      setNotice(updated
        ? { kind: 'success', message: status === 'verified' ? 'Avistamiento aprobado.' : 'Avistamiento rechazado.' }
        : { kind: 'info', message: 'No se modificó el registro: ya fue revisado, no existe o no tienes permiso para editarlo. Se actualizará el listado.' }
      )
      refresh()
    } catch (error) {
      if (!mounted.current) return
      if (error instanceof AdminAccessError) {
        setAccess({ reviewer: null, loading: true, error: '' })
        router.replace('/login')
        return
      }
      setNotice({ kind: 'error', message: errorMessage(error) })
    } finally {
      actionInFlight.current = false
      if (mounted.current) setReviewingId(null)
    }
  }

  async function logout() {
    if (actionInFlight.current) return
    actionInFlight.current = true
    setLoggingOut(true)
    setNotice(null)

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error('No se pudo cerrar la sesión. Inténtalo de nuevo.')
      if (mounted.current) router.replace('/login')
    } catch (error) {
      if (mounted.current) setNotice({ kind: 'error', message: errorMessage(error) })
    } finally {
      actionInFlight.current = false
      if (mounted.current) setLoggingOut(false)
    }
  }

  return {
    ...access,
    data: result.data,
    dataError: loadingData ? '' : result.error,
    filter: query.filter,
    revision,
    loadingData,
    notice,
    reviewingId,
    loggingOut,
    busy,
    retryAccess,
    refresh,
    changeFilter,
    changePage,
    review,
    logout,
  }
}
