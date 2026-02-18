/// <reference types="vite/client" />

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Generic fetch wrapper with error handling
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`

    const token = localStorage.getItem('auth_token')

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
        credentials: 'include',
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || `API Error: ${response.status}`)
    }

    // Handle empty response (204 No Content or empty body)
    const text = await response.text()
    if (!text) {
        return {} as T
    }
    return JSON.parse(text)
}

// GET request
export async function get<T>(endpoint: string): Promise<T> {
    return apiRequest<T>(endpoint, { method: 'GET' })
}

// POST request
export async function post<T>(endpoint: string, data?: unknown): Promise<T> {
    return apiRequest<T>(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
    })
}

// PATCH request
export async function patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return apiRequest<T>(endpoint, {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
    })
}

// PUT request
export async function put<T>(endpoint: string, data?: unknown): Promise<T> {
    return apiRequest<T>(endpoint, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
    })
}

// DELETE request
export async function del<T>(endpoint: string): Promise<T> {
    return apiRequest<T>(endpoint, { method: 'DELETE' })
}

export { API_BASE_URL }
