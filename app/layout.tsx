import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import Provider from "@/components/Provider"

export const metadata: Metadata = {
  title: "Shaders Landing Page",
  description: "Created with v0",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <Provider>{children}</Provider>

      </body>
    </html>
  )
}
