
import { query } from './src/config/db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportData() {
    console.log("Starting data export for AI Model v2.0...");

    // Select space_type instead of source_type for better classification
    const sql = `
        SELECT 
            p.playlist_id, 
            p.title as playlist_title, 
            p.source_type,
            p.space_type, -- Use space_type to distinguish PMS vs EMS
            t.track_id, 
            t.title as track_title, 
            t.artist 
        FROM playlists p
        JOIN playlist_tracks pt ON p.playlist_id = pt.playlist_id
        JOIN tracks t ON pt.track_id = t.track_id
        ORDER BY p.playlist_id
    `;

    try {
        const rows = await query(sql);

        // Group by playlist
        const playlists = {};

        for (const row of rows) {
            if (!playlists[row.playlist_id]) {
                playlists[row.playlist_id] = {
                    playlist_id: row.playlist_id,
                    title: row.playlist_title,
                    // Use space_type: PMS for user, EMS for platform
                    type: row.space_type === 'PMS' ? 'PMS' : 'EMS',
                    tracks: []
                };
            }

            playlists[row.playlist_id].tracks.push({
                track_id: row.track_id,
                title: row.track_title,
                artist: row.artist,
                text: `${row.track_title} ${row.artist}` // Pre-combine for TF-IDF
            });
        }

        const data = Object.values(playlists);
        const outputPath = path.join(__dirname, 'training_data.json');

        await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
        console.log(`Successfully exported ${data.length} playlists to ${outputPath}`);
        console.log(`PMS Playlists: ${data.filter(p => p.type === 'PMS').length}`);
        console.log(`EMS Playlists: ${data.filter(p => p.type === 'EMS').length}`);

    } catch (err) {
        console.error("Error exporting data:", err);
        process.exit(1);
    }
}

exportData();
