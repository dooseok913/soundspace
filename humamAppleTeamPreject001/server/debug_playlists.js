import { query } from './src/config/db.js';

async function checkPlaylists() {
    try {
        console.log('--- Checking Users ---');
        const users = await query('SELECT user_id, email, nickname FROM users');
        console.table(users);

        console.log('\n--- Checking PMS Playlists ---');
        const playlists = await query(`
            SELECT playlist_id, user_id, title, space_type, status_flag 
            FROM playlists 
            WHERE space_type = 'PMS'
        `);
        console.table(playlists);

        if (playlists.length === 0) {
            console.log('No PMS playlists found for ANY user.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

checkPlaylists();
