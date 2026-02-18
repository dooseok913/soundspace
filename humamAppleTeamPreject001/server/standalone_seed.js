
import mysql from 'mysql2/promise';

const config = {
    host: 'localhost',
    port: 3307,
    user: 'musicspace',
    password: 'musicspace123',
    database: 'music_space_db'
};

async function seed() {
    console.log('🌱 Standalone Seeding Starting...');
    console.log('DB Config:', { ...config, password: '****' });

    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to DB');

        // Check tracks
        const [tracks] = await connection.execute('SELECT track_id, artist, album FROM tracks');
        console.log(`Found ${tracks.length} tracks.`);

        // Seed some data
        const [playlists] = await connection.execute('SELECT playlist_id FROM playlists');
        console.log(`Found ${playlists.length} playlists.`);

        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        // Content Stats (Tracks)
        let trackCount = 0;
        for (const track of tracks) {
            const playCount = rand(100, 50000);
            await connection.execute(`
                INSERT INTO content_stats (content_type, content_id, play_count, view_count, like_count)
                VALUES ('track', ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE play_count = VALUES(play_count), view_count = VALUES(view_count)
            `, [track.track_id, playCount, Math.floor(playCount * 1.2), Math.floor(playCount * 0.1)]);
            trackCount++;
        }
        console.log(`✅ ${trackCount} Tracks updated.`);

        // Content Stats (Playlists)
        let playlistCount = 0;
        for (const pl of playlists) {
            const playCount = rand(50, 10000);
            await connection.execute(`
                INSERT INTO content_stats (content_type, content_id, play_count, view_count, like_count)
                VALUES ('playlist', ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE play_count = VALUES(play_count), view_count = VALUES(view_count)
            `, [pl.playlist_id, playCount, Math.floor(playCount * 1.3), Math.floor(playCount * 0.05)]);
            playlistCount++;
        }
        console.log(`✅ ${playlistCount} Playlists updated.`);

        // Artists
        const artists = [...new Set(tracks.map(t => t.artist).filter(Boolean))];
        let artistCount = 0;
        for (const artist of artists) {
            const playCount = rand(1000, 100000);
            await connection.execute(`
                INSERT INTO artist_stats (artist_name, play_count, view_count, like_count)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE play_count = VALUES(play_count), view_count = VALUES(view_count)
            `, [artist, playCount, Math.floor(playCount * 1.4), Math.floor(playCount * 0.2)]);
            artistCount++;
        }
        console.log(`✅ ${artistCount} Artists updated.`);

        // Verify
        const [count] = await connection.execute('SELECT COUNT(*) as c FROM content_stats');
        console.log(`Final content_stats count: ${count[0].c}`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
}

seed();
