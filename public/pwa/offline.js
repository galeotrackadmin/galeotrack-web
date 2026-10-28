const status = document.getElementById('connection')
document.getElementById('retry').addEventListener('click', () => {
  // /offline.html can also be visited directly; a fallback retains its original URL.
  if (location.pathname === '/offline.html') location.assign(new URL('/', location.origin).href)
  else location.reload()
})
window.addEventListener('online', () => { status.textContent = 'La red vuelve a estar disponible. Pulsa Reintentar para continuar.' })
window.addEventListener('offline', () => { status.textContent = 'El dispositivo está sin conexión.' })
