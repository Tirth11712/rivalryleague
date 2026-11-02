import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Rivalry League',
    short_name: 'Rivalry League',
    description: 'Live cricket auction and league.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f2',
    theme_color: '#faf7f2',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
