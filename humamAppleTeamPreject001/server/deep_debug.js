import { query, execute } from './src/config/db.js';

async function deepDebug() {
    try {
        console.log('--- ALL Users ---');
        const users = await query('SELECT user_id, email, nickname FROM users');
        console.table(users);

        console.log('\n--- ALL Playlists (SpaceType + Owner) ---');
        const playlists = await query(`
            SELECT playlist_id, user_id, title, space_type, status_flag 
            FROM playlists
        `);
        console.table(playlists);

        // Check if we have any PMS playlist
        const pms = playlists.filter(p => p.space_type === 'PMS');
        if (pms.length === 0) {
            console.log('❌ Still no PMS playlists found.');
        } else {
            console.log(`✅ Found ${pms.length} PMS playlists.`);
            pms.forEach(p => console.log(`   - ID: ${p.playlist_id}, User: ${p.user_id}, Title: ${p.title}`));
        }

    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

deepDebug();
