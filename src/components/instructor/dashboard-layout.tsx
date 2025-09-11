"use client"

import * as React from "react"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      {children}
    </div>
  )
}
