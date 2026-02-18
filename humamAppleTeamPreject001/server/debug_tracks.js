
import { query } from './src/config/db.js';

async function check() {
    const rows = await query(`
        SELECT t.title, t.external_metadata 
        FROM tracks t
        JOIN playlist_tracks pt ON t.track_id = pt.track_id
        WHERE pt.playlist_id = 18
        LIMIT 1
    `);
    console.log(JSON.stringify(rows[0], null, 2));
    process.exit();
}
check();
