import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MailAccountsState {
  /** Currently active account ID, or null for unified "All Accounts" view */
  activeAccountId: string | null
  /** Whether the user has completed initial email login */
  hasLoggedIn: boolean

  setActiveAccount: (id: string | null) => void
  setHasLoggedIn: (value: boolean) => void
  reset: () => void
}

export const useMailAccountsStore = create<MailAccountsState>()(
  persist(
    (set) => ({
      activeAccountId: null,
      hasLoggedIn: false,

      setActiveAccount: (id) => set({ activeAccountId: id }),
      setHasLoggedIn: (value) => set({ hasLoggedIn: value }),
      reset: () => set({ activeAccountId: null, hasLoggedIn: false }),
    }),
    { name: 'urban-mail-accounts' },
  ),
)
