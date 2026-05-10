import React from 'react'

interface AuthLayoutProps {
  children: React.ReactNode
  title?: string
}

export default function AuthLayout({ children, title }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">StreamyAPI</h1>
          {title && <p className="auth-subtitle">{title}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
