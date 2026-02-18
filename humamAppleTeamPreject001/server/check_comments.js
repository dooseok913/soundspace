import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

const [cols] = await pool.execute(`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_COMMENT
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'music_space_db'
    ORDER BY TABLE_NAME, ORDINAL_POSITION
`)

let currentTable = ''
cols.forEach(c => {
    if (c.TABLE_NAME !== currentTable) {
        currentTable = c.TABLE_NAME
        console.log('\n=== ' + currentTable + ' ===')
    }
    console.log(c.COLUMN_NAME + ':', c.COLUMN_COMMENT || '(없음)')
})

await pool.end()
