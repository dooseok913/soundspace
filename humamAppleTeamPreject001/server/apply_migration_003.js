
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
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

async function applyMigration() {
    console.log('🔄 Applying Migration 003...');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const migrationPath = path.join(__dirname, 'migrations', '003_track_extended_metadata.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log(`📂 Reading ${migrationPath}...`);

        await connection.query(sql);

        console.log('✅ Migration 003 applied successfully.');
        console.log('   - Created/Updated `artists` table');
        console.log('   - Created/Updated `albums` table');
        console.log('   - Added extended columns to `tracks`');

    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

applyMigration();
