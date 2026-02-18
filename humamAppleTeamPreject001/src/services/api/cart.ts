import { get, post, del } from './index'

export interface CartItem {
    id: number
    userId: number
    trackId: number | null
    title: string
    artist: string
    album: string
    artwork: string
    previewUrl: string
    externalId: string | null
    createdAt: string
}

export interface CartResponse {
    success: boolean
    cart: CartItem[]
    count: number
    message?: string
}

export interface AddToCartRequest {
    trackId?: number | null
    title: string
    artist: string
    album?: string
    artwork?: string
    previewUrl?: string
    externalId?: string | null
}

export interface CartAnalysisRequest {
    model?: string
}

export interface CartAnalysisResponse {
    success: boolean
    playlistId?: number
    trackCount?: number
    gmsPlaylistId?: number
    message?: string
    error?: string
}

export const cartApi = {
    // 장바구니 조회
    async getCart(): Promise<CartResponse> {
        return get<CartResponse>('/cart')
    },

    // 장바구니에 추가
    async addToCart(item: AddToCartRequest): Promise<{ success: boolean; cartItemId: number; item: CartItem }> {
        return post<{ success: boolean; cartItemId: number; item: CartItem }>('/cart', item)
    },

    // 장바구니에서 삭제
    async removeFromCart(cartItemId: number): Promise<{ success: boolean; message: string }> {
        return del<{ success: boolean; message: string }>(`/cart/${cartItemId}`)
    },

    // 장바구니 비우기
    async clearCart(): Promise<{ success: boolean; message: string }> {
        return del<{ success: boolean; message: string }>('/cart')
    },

    // 장바구니 분석 요청 (FastAPI에 전달하여 추천받고 GMS로 이동)
    async analyzeCart(request?: CartAnalysisRequest): Promise<CartAnalysisResponse> {
        return post<CartAnalysisResponse>('/cart/analyze', request || {})
    }
}

export default cartApi
