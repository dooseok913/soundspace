import { get, put } from './index'

export const settingsApi = {
    getTheme: () => get<{ theme: string }>('/settings/theme'),
    setTheme: (theme: string) => put<{ theme: string }>('/settings/theme', { theme }),
}
