
import { query } from './src/config/db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportUserTracksCsv() {
    const targetEmail = 'jowoosung21@gmail.com';
    console.log(`Searching for user: ${targetEmail}...`);

    try {
        // 1. Find User ID
        const users = await query('SELECT user_id, email FROM users WHERE email = ?', [targetEmail]);

        if (users.length === 0) {
            console.error(`User not found: ${targetEmail}`);
            process.exit(1);
        }

        const user = users[0];
        console.log(`Found User: ${user.email} (ID: ${user.user_id})`);

        // 2. Export Tracks for this User's Playlists
        console.log("Fetching User Playlist Tracks...");

        const sql = `
            SELECT
                p.title as playlist_title,
                p.description as playlist_description,
                p.source_type,
                p.space_type,
                p.created_at as playlist_created_at,
                pt.added_at as track_added_at,
                pt.order_index,
                t.track_id,
                t.title,
                t.artist,
                t.album,
                t.genre,
                t.release_date,
                t.tempo,
                t.energy,
                t.valence,
                t.danceability,
                t.acousticness,
                t.instrumentalness,
                t.liveness,
                t.speechiness,
                t.loudness,
                t.duration,
                t.isrc,
                t.spotify_id,
                t.popularity,
                t.explicit,
                t.audio_features,
                t.external_metadata
            FROM playlists p
            JOIN playlist_tracks pt ON p.playlist_id = pt.playlist_id
            JOIN tracks t ON pt.track_id = t.track_id
            WHERE p.user_id = ?
            ORDER BY p.title, pt.order_index
        `;

        const rows = await query(sql, [user.user_id]);
        console.log(`Fetched ${rows.length} tracks from user's playlists.`);

        // CSV Header
        const header = [
            'Playlist', 'Playlist Description', 'Source Type', 'Space Type', 'Playlist Created',
            'Track Added At', 'Order',
            'Track ID', 'Title', 'Artist', 'Album', 'Genre', 'Release Date', 'ISRC', 'Spotify ID', 'Popularity', 'Explicit',
            'Tempo (BPM)', 'Energy', 'Valence', 'Danceability',
            'Acousticness', 'Instrumentalness', 'Liveness', 'Speechiness', 'Loudness', 'Duration (ms)',
            'Audio Features (Raw)', 'External Metadata (Raw)'
        ].join(',');

        // CSV Rows
        const csvRows = rows.map(row => {
            return [
                `"${(row.playlist_title || '').replace(/"/g, '""')}"`,
                `"${(row.playlist_description || '').replace(/"/g, '""')}"`,
                row.source_type || '',
                row.space_type || '',
                row.playlist_created_at ? new Date(row.playlist_created_at).toISOString() : '',
                row.track_added_at ? new Date(row.track_added_at).toISOString() : '',
                row.order_index || '',
                row.track_id,
                `"${(row.title || '').replace(/"/g, '""')}"`,
                `"${(row.artist || '').replace(/"/g, '""')}"`,
                `"${(row.album || '').replace(/"/g, '""')}"`,
                `"${(row.genre || '').replace(/"/g, '""')}"`,
                row.release_date ? new Date(row.release_date).toISOString().split('T')[0] : '',
                row.isrc || '',
                row.spotify_id || '',
                row.popularity || '',
                row.explicit ? 'Yes' : 'No',
                row.tempo || '',
                row.energy || '',
                row.valence || '',
                row.danceability || '',
                row.acousticness || '',
                row.instrumentalness || '',
                row.liveness || '',
                row.speechiness || '',
                row.loudness || '',
                row.duration || '',
                `"${(row.audio_features || '').replace(/"/g, '""')}"`,
                `"${(row.external_metadata || '').replace(/"/g, '""')}"`
            ].join(',');
        });

        const csvContent = [header, ...csvRows].join('\n');
        const outputPath = path.join(__dirname, 'jowoosung_tracks.csv');

        await fs.writeFile(outputPath, csvContent);
        console.log(`Successfully exported to ${outputPath}`);

    } catch (err) {
        console.error("Error exporting CSV:", err);
        process.exit(1);
    }
}

exportUserTracksCsv();
