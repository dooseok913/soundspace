
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
    port: parseInt(process.env.DB_PORT || '3306')
};

async function createTable() {
    console.log('🔨 Creating `artists` table...');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        const sql = `
            CREATE TABLE IF NOT EXISTS \`artists\` (
                \`artist_id\` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아티스트 ID',
                \`name\` VARCHAR(255) NOT NULL COMMENT '아티스트명',
                \`spotify_id\` VARCHAR(22) DEFAULT NULL COMMENT 'Spotify Artist ID',
                \`mbid\` VARCHAR(36) DEFAULT NULL COMMENT 'MusicBrainz ID',
                \`genres\` JSON DEFAULT NULL COMMENT '장르 목록 (JSON 배열)',
                \`popularity\` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Spotify 인기도',
                \`followers\` INT UNSIGNED DEFAULT NULL COMMENT 'Spotify 팔로워 수',
                \`image_url\` VARCHAR(500) DEFAULT NULL COMMENT '아티스트 이미지 URL',
                \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`artist_id\`),
                UNIQUE KEY \`uk_spotify_id\` (\`spotify_id\`),
                KEY \`idx_name\` (\`name\`),
                KEY \`idx_mbid\` (\`mbid\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='아티스트 정보 테이블';
        `;

        await connection.query(sql);
        console.log('✅ `artists` table verified/created.');

    } catch (error) {
        console.error('❌ Failed to create table:', error);
    } finally {
        if (connection) await connection.end();
    }
}

createTable();
