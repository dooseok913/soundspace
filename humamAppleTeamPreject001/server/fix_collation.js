
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'music_space_db',
    port: parseInt(process.env.DB_PORT || '3306'),
    multipleStatements: true
};

async function fixCollation() {
    console.log('🔧 Fixing Collation Issues...');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        // Check current collations
        const [tables] = await connection.query(`
            SELECT TABLE_NAME, TABLE_COLLATION 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${dbConfig.database}' 
            AND TABLE_NAME IN ('artists', 'artist_stats')
        `);
        console.log('Current Collations:', tables);

        // Unify to utf8mb4_unicode_ci (standard for this project)
        // First artist_stats
        await connection.query(`ALTER TABLE artist_stats CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log('✅ Converted artist_stats to utf8mb4_unicode_ci');

        // Then artists
        await connection.query(`ALTER TABLE artists CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log('✅ Converted artists to utf8mb4_unicode_ci');

    } catch (error) {
        console.error('❌ Failed to fix collation:', error);
    } finally {
        if (connection) await connection.end();
    }
}

fixCollation();
