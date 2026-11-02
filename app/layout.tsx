import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: 'The Rivalry League | Official Cricket Auction',
  description: 'Official live auction management and player draft for The Rivalry League.',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Rivalry League',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#faf7f2',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body>{children}</body>
    </html>
  )
}
