import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../features/auth/AuthProvider'
import type { ReactNode } from 'react'
import { ThemeProvider } from '../components/ui-shell/ThemeProvider'

const queryClient = new QueryClient()

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
