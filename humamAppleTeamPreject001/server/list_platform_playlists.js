
import { query } from './src/config/db.js';

async function check() {
    const rows = await query(`
        SELECT playlist_id, title, source_type, external_id, 
        (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = playlists.playlist_id) as track_count 
        FROM playlists 
        WHERE source_type = 'Platform'
    `);
    console.log(JSON.stringify(rows, null, 2));
    process.exit();
}
check();
