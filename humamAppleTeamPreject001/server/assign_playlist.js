import { query, execute } from './src/config/db.js';

async function assignToLatestUser() {
    try {
        console.log('--- Re-assigning Playlist ---');

        // Get latest user
        const users = await query('SELECT user_id, email FROM users ORDER BY user_id DESC LIMIT 1');
        if (users.length === 0) {
            console.log('No users found.');
            process.exit();
        }
        const latestUser = users[0];
        console.log(`Latest User: ${latestUser.email} (ID: ${latestUser.user_id})`);

        // Find the PMS playlist
        const playlists = await query("SELECT playlist_id FROM playlists WHERE space_type = 'PMS' LIMIT 1");

        if (playlists.length > 0) {
            const pid = playlists[0].playlist_id;
            console.log(`Assigning PMS Playlist ${pid} to User ${latestUser.user_id}...`);
            await execute('UPDATE playlists SET user_id = ? WHERE playlist_id = ?', [latestUser.user_id, pid]);
            console.log('Success!');
        } else {
            console.log('No PMS playlist found to assign.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

assignToLatestUser();
