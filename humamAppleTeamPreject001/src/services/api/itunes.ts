import { get } from './index';

export interface ItunesTrack {
    id: number;
    title: string;
    artist: string;
    album: string;
    artwork: string;
    audio: string;
    url: string;
    date: string;
    previewUrl?: string; // Alias for audio/preview
}

export interface ItunesCollection {
    id: number;
    title: string;
    artist: string;
    artwork: string;
    count: number;
    genre: string;
    date: string;
}

export const itunesService = {
    search: async (term: string): Promise<ItunesTrack[]> => {
        try {
            const response = await get<{ results: any[] }>(`/itunes/search?term=${encodeURIComponent(term)}`);
            // Safe null check to prevent crash when results is undefined
            const results = response?.results || [];
            return results.map(item => ({
                ...item,
                previewUrl: item.audio || item.previewUrl // Ensure previewUrl is populated
            })) as ItunesTrack[];
        } catch (error) {
            console.error('iTunes search failed:', error);
            return [];
        }
    },

    getRecommendations: async (genre?: string): Promise<ItunesCollection[]> => {
        try {
            const query = genre ? `?genre=${encodeURIComponent(genre)}` : '';
            const response = await get<{ recommendations: ItunesCollection[] }>(`/itunes/recommendations${query}`);
            // Safe null check
            return response?.recommendations || [];
        } catch (error) {
            console.error('iTunes recommendations failed:', error);
            return [];
        }
    },

    getAlbum: async (id: number) => {
        try {
            return await get<{ id: number; title: string; artist: string; tracks: ItunesTrack[] }>(`/itunes/album/${id}`);
        } catch (error) {
            console.error('iTunes album fetch failed:', error);
            return { id, title: '', artist: '', tracks: [] };
        }
    }
};
