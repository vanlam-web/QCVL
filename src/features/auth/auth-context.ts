import { createContext, useContext } from 'react'
import type { AccessConnectionState } from '../../lib/realtime/access-channel'
import type { CurrentUserData } from '../../lib/api/types'
import type { AuthService } from './auth-service'

export interface AuthContextValue extends AuthService {
  initialized: boolean
  accessConnection: AccessConnectionState
  currentUser: CurrentUserData | null
  refreshMe(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const service = useContext(AuthContext)
  if (!service) {
    throw new Error('AuthProvider is required')
  }
  return service
}

export const useAuthService = useAuth
