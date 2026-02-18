import { query } from './src/config/db.js';

async function checkImageValues() {
    try {
        console.log('--- Checking PMS Playlist Images ---');
        const playlists = await query(`
            SELECT playlist_id, title, cover_image, source_type, external_id 
            FROM playlists 
            WHERE space_type = 'PMS'
        `);

        playlists.forEach(p => {
            console.log(`[${p.source_type}] ${p.title}`);
            console.log(`   ID: ${p.external_id}`);
            console.log(`   Img: ${p.cover_image}`);
            console.log('---');
        });

    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

checkImageValues();
