import { useEffect, useState } from 'react'
import api from '../lib/axios'

export function AuthImage({ path, className, alt = '' }: { path: string; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    let objectUrl: string | undefined
    let cancelled = false
    api
      .get(path, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(data)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(undefined)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])

  if (!url) return <div className={className} />
  return <img src={url} alt={alt} className={className} />
}
