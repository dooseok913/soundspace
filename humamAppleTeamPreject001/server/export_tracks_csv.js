
import { query } from './src/config/db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportTracksCsv() {
    console.log("Starting Track Metadata CSV Export...");

    try {
        const sql = `
            SELECT 
                track_id,
                title,
                artist,
                album,
                genre,
                release_date,
                tempo,
                energy,
                valence,
                danceability,
                acousticness,
                instrumentalness,
                liveness,
                speechiness,
                loudness,
                duration
            FROM tracks
            ORDER BY track_id
        `;

        const rows = await query(sql);
        console.log(`Fetched ${rows.length} tracks.`);

        // CSV Header
        const header = [
            'Track ID', 'Title', 'Artist', 'Album', 'Genre', 'Release Date',
            'Tempo (BPM)', 'Energy', 'Valence', 'Danceability',
            'Acousticness', 'Instrumentalness', 'Liveness', 'Speechiness', 'Loudness', 'Duration (ms)'
        ].join(',');

        // CSV Rows
        const csvRows = rows.map(row => {
            return [
                row.track_id,
                `"${(row.title || '').replace(/"/g, '""')}"`, // Escape quotes
                `"${(row.artist || '').replace(/"/g, '""')}"`,
                `"${(row.album || '').replace(/"/g, '""')}"`,
                `"${(row.genre || '').replace(/"/g, '""')}"`,
                row.release_date ? new Date(row.release_date).toISOString().split('T')[0] : '', // YYYY-MM-DD
                row.tempo || '',
                row.energy || '',
                row.valence || '',
                row.danceability || '',
                row.acousticness || '',
                row.instrumentalness || '',
                row.liveness || '',
                row.speechiness || '',
                row.loudness || '',
                row.duration || ''
            ].join(',');
        });

        const csvContent = [header, ...csvRows].join('\n');
        const outputPath = path.join(__dirname, 'tracks_metadata.csv');

        await fs.writeFile(outputPath, csvContent);
        console.log(`Successfully exported to ${outputPath}`);

    } catch (err) {
        console.error("Error exporting CSV:", err);
        process.exit(1);
    }
}

exportTracksCsv();
