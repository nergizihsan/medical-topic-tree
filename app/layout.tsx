import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: 'MSRA Topic Tree Editor',
  description: 'Internal dashboard for editing the MSRA topic tree',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster 
          position="top-center"
          expand={false}
          richColors
        />
      </body>
    </html>
  )
}
