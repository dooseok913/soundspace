
import { queryOne } from './src/config/db.js';

async function checkCounts() {
    try {
        const tracks = await queryOne('SELECT COUNT(*) as count FROM tracks');
        const playlists = await queryOne('SELECT COUNT(*) as count FROM playlists');
        const artists = await queryOne('SELECT COUNT(DISTINCT artist) as count FROM tracks');
        const albums = await queryOne('SELECT COUNT(DISTINCT album) as count FROM tracks'); // approximating albums from tracks if albums table usage is unsure

        console.log('--- Database Counts ---');
        console.log(`Tracks: ${tracks.count}`);
        console.log(`Playlists: ${playlists.count}`);
        console.log(`Artists: ${artists.count}`);
        console.log(`Albums (approx): ${albums.count}`);

    } catch (error) {
        console.error('Error checking counts:', error);
    } finally {
        process.exit();
    }
}

checkCounts();
