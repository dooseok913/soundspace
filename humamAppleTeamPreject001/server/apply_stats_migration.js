
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execute } from './src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
    try {
        const migrationFile = path.join(__dirname, 'migrations', 'create_stats_tables.sql');
        const sql = fs.readFileSync(migrationFile, 'utf8');

        // Split by semicolon to execute individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        console.log(`Found ${statements.length} statements to execute.`);

        for (const statement of statements) {
            await execute(statement);
            console.log('Executed statement successfully.');
        }

        console.log('✅ Migration applied successfully.');

        // Update schema_definitions.txt
        const schemaFile = path.join(__dirname, 'schema_definitions.txt');
        const currentSchema = fs.readFileSync(schemaFile, 'utf8');

        if (!currentSchema.includes('content_stats')) {
            fs.appendFileSync(schemaFile, '\n\n' + sql);
            console.log('✅ schema_definitions.txt updated.');
        } else {
            console.log('ℹ️ schema_definitions.txt already contains stats tables.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        process.exit();
    }
}

applyMigration();
