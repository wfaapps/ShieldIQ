'use client'
import { create } from 'zustand'

interface OrgBranding {
  name: string
  accentColor: string
  appTitle: string
  logoUrl?: string
}

interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  orgId: string
  org: OrgBranding
}

interface AuthStore {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  updateBranding: (branding: Partial<OrgBranding>) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  updateBranding: (branding) =>
    set((state) =>
      state.user
        ? { user: { ...state.user, org: { ...state.user.org, ...branding } } }
        : state,
    ),
}))
