import "./globals.css"

import type { Metadata } from "next"
import { Geist, Geist_Mono, Manrope } from "next/font/google"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ChatProvider } from "@/contexts/chat-context"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "REKDIN",
  description: "LangChain + OpenRouter research and automation workspace",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ChatProvider>
            {children}
            <Toaster />
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
