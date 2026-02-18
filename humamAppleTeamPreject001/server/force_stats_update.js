
import { execute } from './src/config/db.js';

async function forceUpdate() {
    console.log('🔨 Forcing stats update...');
    try {
        // Insert a dummy track stat
        const result = await execute(`
            INSERT INTO content_stats (content_type, content_id, play_count, view_count) 
            VALUES ('track', 1, 9999, 15000)
            ON DUPLICATE KEY UPDATE play_count = 9999, view_count = 15000
        `);
        console.log('Update result:', result);

        // Insert a dummy artist stat
        const artistResult = await execute(`
            INSERT INTO artist_stats (artist_name, play_count, view_count)
            VALUES ('NewJeans', 1000000, 2000000)
            ON DUPLICATE KEY UPDATE play_count = 1000000, view_count = 2000000
        `);
        console.log('Artist update result:', artistResult);

    } catch (error) {
        console.error('Error forcing update:', error);
    } finally {
        process.exit();
    }
}

forceUpdate();
