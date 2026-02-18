
import mysql from 'mysql2/promise';

const config = {
    host: 'localhost',
    port: 3307,
    user: 'musicspace',
    password: 'musicspace123',
    database: 'music_space_db'
};

async function verifyData() {
    console.log('🔍 Explicitly verifying stats data...');
    let connection;
    try {
        connection = await mysql.createConnection(config);

        const [contentStatsCount] = await connection.query('SELECT COUNT(*) as count FROM content_stats');
        const [artistStatsCount] = await connection.query('SELECT COUNT(*) as count FROM artist_stats');

        console.log(`Total content_stats rows: ${contentStatsCount[0].count}`);
        console.log(`Total artist_stats rows: ${artistStatsCount[0].count}`);

        if (contentStatsCount[0].count > 0) {
            const [sampleContent] = await connection.query('SELECT * FROM content_stats LIMIT 3');
            console.log('Sample content_stats:', sampleContent);
        }

        if (artistStatsCount[0].count > 0) {
            const [sampleArtist] = await connection.query('SELECT * FROM artist_stats LIMIT 3');
            console.log('Sample artist_stats:', sampleArtist);
        }

        console.log('✅ Verification successful if counts > 0');

    } catch (error) {
        console.error('❌ Verification failed with error:', error);
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
}

verifyData();
