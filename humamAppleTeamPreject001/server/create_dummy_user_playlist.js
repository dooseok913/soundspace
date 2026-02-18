
import { query, insert } from './src/config/db.js';

async function createDummyPlaylist() {
    console.log("Creating dummy User playlist...");

    try {
        const userId = 1;

        // 1. Create Playlist
        const playlistSql = `
            INSERT INTO playlists (title, description, user_id, source_type, space_type) 
            VALUES (?, ?, ?, ?, ?)
        `;
        const playlistId = await insert(playlistSql, [
            'My Favorite Jazz Vibes',
            'A user created playlist for testing recommendations',
            userId,
            'System', // source_type: System
            'PMS'     // space_type: PMS (Personal Music Space)
        ]);

        console.log(`Created playlist ID: ${playlistId} (PMS/System)`);

        // 2. Get some tracks (e.g., from existing jazz playlists)
        let tracks = await query("SELECT track_id FROM tracks WHERE title LIKE '%Jazz%' LIMIT 10");

        if (tracks.length === 0) {
            console.log("No 'Jazz' tracks found, grabbing any 10 tracks...");
            tracks = await query("SELECT track_id FROM tracks LIMIT 10");
        }

        // 3. Add tracks to playlist
        for (const t of tracks) {
            await insert('INSERT INTO playlist_tracks (playlist_id, track_id, added_at) VALUES (?, ?, ?)', [
                playlistId,
                t.track_id,
                new Date()
            ]);
        }

        console.log(`Added ${tracks.length} tracks to playlist ${playlistId}`);
        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

createDummyPlaylist();
