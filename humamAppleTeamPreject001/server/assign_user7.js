import { query, execute } from './src/config/db.js';

async function assignToUser7() {
    try {
        const targetUserId = 7;
        console.log(`--- Assigning PMS Playlist to User ${targetUserId} ---`);

        // Find the PMS playlist (or any playlist if not found)
        let playlists = await query("SELECT playlist_id FROM playlists WHERE space_type = 'PMS' LIMIT 1");

        if (playlists.length === 0) {
            console.log('No PMS playlist found. Finding any playlist to convert...');
            playlists = await query("SELECT playlist_id FROM playlists LIMIT 1");
            if (playlists.length > 0) {
                await execute("UPDATE playlists SET space_type = 'PMS' WHERE playlist_id = ?", [playlists[0].playlist_id]);
                console.log(`Converted playlist ${playlists[0].playlist_id} to PMS.`);
            }
        }

        if (playlists.length > 0) {
            const pid = playlists[0].playlist_id;
            await execute('UPDATE playlists SET user_id = ? WHERE playlist_id = ?', [targetUserId, pid]);
            console.log(`Success! Assigned Playlist ${pid} to User ${targetUserId}.`);
        } else {
            console.log('No playlists found at all.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

assignToUser7();
