
import { query } from './src/config/db.js';

async function check() {
    const rows = await query("SELECT * FROM playlists WHERE playlist_id = 18");
    console.log(JSON.stringify(rows, null, 2));
    process.exit();
}
check();
