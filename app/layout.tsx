import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Wishlist - Dating App',
  description: 'Connect with people you already know',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
