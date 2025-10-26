import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import Provider from "@/components/Provider"

export const metadata: Metadata = {
  title: "NexPay",
  description: "NexPay is a unified cross-chain payments platform built on Avail Nexus — with seamless Across Protocol bridging for assets beyond the Nexus ecosystem.",
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
