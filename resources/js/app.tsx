/// <reference types="vite/client" />
import { createInertiaApp } from '@inertiajs/react'
import { createRoot } from 'react-dom/client'
import type { ComponentType } from 'react'

createInertiaApp({
  resolve: (name: string) => {
    const pages = import.meta.glob('./pages/**/*.tsx', { eager: true }) as Record<
      string,
      { default: ComponentType }
    >
    return pages[`./pages/${name}.tsx`]
  },
  setup({ el, App, props }: { el: Element; App: ComponentType<any>; props: Record<string, unknown> }) {
    createRoot(el).render(<App {...props} />)
  },
  progress: { color: '#6366f1' },
})
