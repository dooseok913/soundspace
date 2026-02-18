const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export interface Genre {
    id: number
    code: string
    nameKo: string
    nameEn: string
    icon: string
    color: string
    displayOrder: number
    categoryId?: number
}

export interface GenreCategory {
    id: number
    code: string
    nameKo: string
    nameEn: string
    icon: string
    displayOrder: number
    genres: Genre[]
}

export interface GenresResponse {
    success: boolean
    categories: GenreCategory[]
    genres: Genre[]
}

export const genresApi = {
    // 카테고리별로 그룹핑된 장르 목록 조회
    async getGenresGrouped(): Promise<GenreCategory[]> {
        try {
            const response = await fetch(`${API_BASE}/genres`)
            if (!response.ok) {
                throw new Error('장르 목록을 불러오는데 실패했습니다')
            }
            const data: GenresResponse = await response.json()
            return data.categories || []
        } catch (error) {
            console.error('Genres API Error:', error)
            // API 실패 시 기본 장르 목록 반환
            return getDefaultGenresGrouped()
        }
    },

    // 플랫 리스트로 장르 목록 조회
    async getGenres(): Promise<Genre[]> {
        try {
            const response = await fetch(`${API_BASE}/genres`)
            if (!response.ok) {
                throw new Error('장르 목록을 불러오는데 실패했습니다')
            }
            const data: GenresResponse = await response.json()
            return data.genres || []
        } catch (error) {
            console.error('Genres API Error:', error)
            return getDefaultGenres()
        }
    }
}

// API 호출 실패 시 사용할 기본 카테고리별 장르 목록
function getDefaultGenresGrouped(): GenreCategory[] {
    return [
        {
            id: 1,
            code: 'popular',
            nameKo: '인기 장르',
            nameEn: 'Popular',
            icon: '',
            displayOrder: 1,
            genres: [
                { id: 1, code: 'k-pop', nameKo: 'K-POP', nameEn: 'K-POP', icon: '', color: 'from-pink-500 to-purple-500', displayOrder: 1 },
                { id: 2, code: 'pop', nameKo: '팝', nameEn: 'Pop', icon: '', color: 'from-blue-400 to-cyan-400', displayOrder: 2 },
                { id: 3, code: 'j-pop', nameKo: 'J-POP', nameEn: 'J-POP', icon: '', color: 'from-red-400 to-pink-400', displayOrder: 3 },
                { id: 4, code: 'indie', nameKo: '인디', nameEn: 'Indie', icon: '', color: 'from-green-400 to-teal-500', displayOrder: 4 },
                { id: 5, code: 'indie-pop', nameKo: '인디팝', nameEn: 'Indie Pop', icon: '', color: 'from-emerald-400 to-cyan-400', displayOrder: 5 },
                { id: 6, code: 'anime', nameKo: '애니메이션', nameEn: 'Anime', icon: '', color: 'from-violet-400 to-purple-500', displayOrder: 6 },
                { id: 7, code: 'soundtracks', nameKo: 'OST', nameEn: 'Soundtracks', icon: '', color: 'from-amber-400 to-orange-400', displayOrder: 7 },
            ]
        },
        {
            id: 2,
            code: 'electronic',
            nameKo: '일렉트로닉',
            nameEn: 'Electronic',
            icon: '',
            displayOrder: 2,
            genres: [
                { id: 10, code: 'edm', nameKo: 'EDM', nameEn: 'EDM', icon: '', color: 'from-cyan-400 to-blue-500', displayOrder: 10 },
                { id: 11, code: 'house', nameKo: '하우스', nameEn: 'House', icon: '', color: 'from-purple-500 to-pink-500', displayOrder: 11 },
                { id: 12, code: 'deep-house', nameKo: '딥하우스', nameEn: 'Deep House', icon: '', color: 'from-indigo-500 to-purple-500', displayOrder: 12 },
                { id: 13, code: 'techno', nameKo: '테크노', nameEn: 'Techno', icon: '', color: 'from-gray-600 to-gray-800', displayOrder: 13 },
                { id: 14, code: 'trance', nameKo: '트랜스', nameEn: 'Trance', icon: '', color: 'from-cyan-500 to-blue-600', displayOrder: 14 },
                { id: 15, code: 'dubstep', nameKo: '덥스텝', nameEn: 'Dubstep', icon: '', color: 'from-purple-600 to-indigo-600', displayOrder: 15 },
                { id: 16, code: 'drum-and-bass', nameKo: '드럼앤베이스', nameEn: 'Drum and Bass', icon: '', color: 'from-orange-500 to-red-500', displayOrder: 16 },
                { id: 17, code: 'synth-pop', nameKo: '신스팝', nameEn: 'Synth Pop', icon: '', color: 'from-pink-400 to-rose-500', displayOrder: 17 },
                { id: 18, code: 'disco', nameKo: '디스코', nameEn: 'Disco', icon: '', color: 'from-fuchsia-500 to-pink-500', displayOrder: 18 },
            ]
        },
        {
            id: 3,
            code: 'rock_metal',
            nameKo: '락/메탈',
            nameEn: 'Rock & Metal',
            icon: '',
            displayOrder: 3,
            genres: [
                { id: 30, code: 'rock', nameKo: '락', nameEn: 'Rock', icon: '', color: 'from-red-500 to-orange-500', displayOrder: 30 },
                { id: 31, code: 'alt-rock', nameKo: '얼터너티브 락', nameEn: 'Alternative Rock', icon: '', color: 'from-slate-500 to-gray-600', displayOrder: 31 },
                { id: 32, code: 'hard-rock', nameKo: '하드락', nameEn: 'Hard Rock', icon: '', color: 'from-red-600 to-red-800', displayOrder: 32 },
                { id: 33, code: 'punk', nameKo: '펑크', nameEn: 'Punk', icon: '', color: 'from-lime-500 to-green-600', displayOrder: 33 },
                { id: 34, code: 'metal', nameKo: '메탈', nameEn: 'Metal', icon: '', color: 'from-gray-700 to-gray-900', displayOrder: 34 },
                { id: 35, code: 'heavy-metal', nameKo: '헤비메탈', nameEn: 'Heavy Metal', icon: '', color: 'from-zinc-700 to-black', displayOrder: 35 },
                { id: 36, code: 'emo', nameKo: '이모', nameEn: 'Emo', icon: '', color: 'from-gray-600 to-purple-700', displayOrder: 36 },
            ]
        },
        {
            id: 4,
            code: 'urban',
            nameKo: '어반/힙합',
            nameEn: 'Urban & Hip-Hop',
            icon: '',
            displayOrder: 4,
            genres: [
                { id: 50, code: 'hip-hop', nameKo: '힙합', nameEn: 'Hip-Hop', icon: '', color: 'from-orange-500 to-red-500', displayOrder: 50 },
                { id: 51, code: 'r-n-b', nameKo: 'R&B', nameEn: 'R&B', icon: '', color: 'from-purple-500 to-pink-500', displayOrder: 51 },
                { id: 52, code: 'soul', nameKo: '소울', nameEn: 'Soul', icon: '', color: 'from-amber-500 to-orange-500', displayOrder: 52 },
                { id: 53, code: 'funk', nameKo: '펑크', nameEn: 'Funk', icon: '', color: 'from-yellow-500 to-orange-500', displayOrder: 53 },
                { id: 54, code: 'gospel', nameKo: '가스펠', nameEn: 'Gospel', icon: '', color: 'from-yellow-400 to-amber-500', displayOrder: 54 },
                { id: 55, code: 'reggae', nameKo: '레게', nameEn: 'Reggae', icon: '', color: 'from-green-500 to-yellow-400', displayOrder: 55 },
                { id: 56, code: 'reggaeton', nameKo: '레게톤', nameEn: 'Reggaeton', icon: '', color: 'from-red-500 to-yellow-500', displayOrder: 56 },
            ]
        },
        {
            id: 5,
            code: 'acoustic',
            nameKo: '어쿠스틱/포크',
            nameEn: 'Acoustic & Folk',
            icon: '',
            displayOrder: 5,
            genres: [
                { id: 60, code: 'acoustic', nameKo: '어쿠스틱', nameEn: 'Acoustic', icon: '', color: 'from-amber-400 to-yellow-500', displayOrder: 60 },
                { id: 61, code: 'folk', nameKo: '포크', nameEn: 'Folk', icon: '', color: 'from-orange-400 to-amber-500', displayOrder: 61 },
                { id: 62, code: 'singer-songwriter', nameKo: '싱어송라이터', nameEn: 'Singer-Songwriter', icon: '', color: 'from-rose-400 to-pink-500', displayOrder: 62 },
                { id: 63, code: 'country', nameKo: '컨트리', nameEn: 'Country', icon: '', color: 'from-amber-600 to-orange-500', displayOrder: 63 },
                { id: 64, code: 'blues', nameKo: '블루스', nameEn: 'Blues', icon: '', color: 'from-blue-600 to-indigo-600', displayOrder: 64 },
                { id: 65, code: 'jazz', nameKo: '재즈', nameEn: 'Jazz', icon: '', color: 'from-amber-500 to-yellow-400', displayOrder: 65 },
                { id: 66, code: 'classical', nameKo: '클래식', nameEn: 'Classical', icon: '', color: 'from-slate-400 to-gray-500', displayOrder: 66 },
                { id: 67, code: 'piano', nameKo: '피아노', nameEn: 'Piano', icon: '', color: 'from-gray-400 to-slate-500', displayOrder: 67 },
            ]
        },
        {
            id: 6,
            code: 'world',
            nameKo: '월드뮤직',
            nameEn: 'World Music',
            icon: '',
            displayOrder: 6,
            genres: [
                { id: 80, code: 'latin', nameKo: '라틴', nameEn: 'Latin', icon: '', color: 'from-red-500 to-orange-400', displayOrder: 80 },
                { id: 81, code: 'salsa', nameKo: '살사', nameEn: 'Salsa', icon: '', color: 'from-red-500 to-yellow-500', displayOrder: 81 },
                { id: 82, code: 'bossanova', nameKo: '보사노바', nameEn: 'Bossa Nova', icon: '', color: 'from-teal-400 to-cyan-500', displayOrder: 82 },
                { id: 83, code: 'afrobeat', nameKo: '아프로비트', nameEn: 'Afrobeat', icon: '', color: 'from-orange-500 to-yellow-500', displayOrder: 83 },
                { id: 84, code: 'indian', nameKo: '인디안', nameEn: 'Indian', icon: '', color: 'from-orange-500 to-red-500', displayOrder: 84 },
                { id: 85, code: 'world-music', nameKo: '월드뮤직', nameEn: 'World Music', icon: '', color: 'from-teal-500 to-emerald-500', displayOrder: 85 },
            ]
        },
        {
            id: 7,
            code: 'mood',
            nameKo: '분위기/무드',
            nameEn: 'Mood & Vibes',
            icon: '',
            displayOrder: 7,
            genres: [
                { id: 100, code: 'chill', nameKo: '칠', nameEn: 'Chill', icon: '', color: 'from-cyan-400 to-blue-400', displayOrder: 100 },
                { id: 101, code: 'ambient', nameKo: '앰비언트', nameEn: 'Ambient', icon: '', color: 'from-slate-400 to-blue-400', displayOrder: 101 },
                { id: 102, code: 'romance', nameKo: '로맨스', nameEn: 'Romance', icon: '', color: 'from-pink-400 to-rose-400', displayOrder: 102 },
                { id: 103, code: 'happy', nameKo: '해피', nameEn: 'Happy', icon: '', color: 'from-yellow-400 to-orange-400', displayOrder: 103 },
                { id: 104, code: 'party', nameKo: '파티', nameEn: 'Party', icon: '', color: 'from-fuchsia-500 to-pink-500', displayOrder: 104 },
                { id: 105, code: 'dance', nameKo: '댄스', nameEn: 'Dance', icon: '', color: 'from-pink-500 to-purple-500', displayOrder: 105 },
                { id: 106, code: 'sleep', nameKo: '수면', nameEn: 'Sleep', icon: '', color: 'from-indigo-400 to-purple-500', displayOrder: 106 },
                { id: 107, code: 'study', nameKo: '공부', nameEn: 'Study', icon: '', color: 'from-green-400 to-teal-400', displayOrder: 107 },
                { id: 108, code: 'work-out', nameKo: '운동', nameEn: 'Work Out', icon: '', color: 'from-red-500 to-orange-500', displayOrder: 108 },
            ]
        }
    ]
}

// 플랫 리스트 기본 장르
function getDefaultGenres(): Genre[] {
    const grouped = getDefaultGenresGrouped()
    return grouped.flatMap(category => category.genres)
}
