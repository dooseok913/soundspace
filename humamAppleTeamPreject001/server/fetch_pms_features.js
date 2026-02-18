
import { query } from './src/config/db.js';

async function fetchPmsFeatures() {
    console.log("Searching for tracks with space_type = 'PMS'...");

    const sql = `
        SELECT
            t.title,
            t.artist,
            t.genre,
            t.popularity,
            t.album,
            t.duration
        FROM playlists p
        JOIN playlist_tracks pt ON p.playlist_id = pt.playlist_id
        JOIN tracks t ON pt.track_id = t.track_id
        WHERE p.space_type = 'PMS'
          AND t.genre IS NOT NULL
        LIMIT 20;
    `;

    try {
        const rows = await query(sql);

        if (rows.length === 0) {
            console.log("No tracks found with space_type = 'PMS'.");
            return;
        }

        console.log(JSON.stringify(rows, null, 2));

    } catch (err) {
        console.error("Error fetching data:", err);
    } finally {
        process.exit();
    }
}

fetchPmsFeatures();
