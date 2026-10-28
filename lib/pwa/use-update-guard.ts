'use client'

import { useEffect } from 'react'
import { addUpdateGuard } from './update-safety'

/** Prevent voluntary PWA reloads during editing or a mutation, without persisting data. */
export function useUpdateGuard(blocked: boolean) {
  useEffect(() => {
    if (blocked) return addUpdateGuard()
  }, [blocked])
}
