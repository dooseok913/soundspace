
import { query } from './src/config/db.js';

async function check() {
    const rows = await query("SELECT playlist_id, title, external_id, source_type FROM playlists WHERE playlist_id = 18");
    console.log(rows);
    process.exit();
}
check();
