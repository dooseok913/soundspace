import { query, execute } from './src/config/db.js';

async function fixPlaylists() {
    try {
        console.log('--- Fixing Playlists ---');

        // Find any playlist
        const existing = await query('SELECT playlist_id FROM playlists LIMIT 1');

        if (existing.length > 0) {
            const id = existing[0].playlist_id;
            console.log(`Moving playlist ${id} to PMS...`);

            await execute(`UPDATE playlists SET space_type = 'PMS' WHERE playlist_id = ?`, [id]);
            console.log('Success!');
        } else {
            console.log('No playlists found to fix. Please create one first (e.g. sync from Tidal).');
        }

    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

fixPlaylists();
