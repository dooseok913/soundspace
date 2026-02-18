
import { query } from './src/config/db.js';

async function findPlaylist() {
    try {
        const playlists = await query("SELECT * FROM playlists WHERE title LIKE '%coffeeAndJazz%'");
        console.log('Found playlists:', playlists);

        if (playlists.length > 0) {
            const pid = playlists[0].playlist_id;
            const tracks = await query("SELECT count(*) as count FROM playlist_tracks WHERE playlist_id = ?", [pid]);
            console.log(`Track count for playlist ${pid}:`, tracks[0].count);
        }
    } catch (error) {
        console.error(error);
    }
    process.exit();
}

findPlaylist();
