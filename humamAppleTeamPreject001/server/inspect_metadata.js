
import { query, queryOne } from './src/config/db.js';

async function inspectMetadata() {
    try {
        console.log('Fetching Tracks Metadata Schema and Sample...');

        // Get Schema
        const schema = await query('DESCRIBE tracks');

        // Get One Sample with data
        const sample = await queryOne('SELECT * FROM tracks LIMIT 1');

        console.log('\n=== AUDIO ANALYSIS METADATA ===');
        const audioFields = [
            'tempo', 'music_key', 'mode', 'time_signature',
            'danceability', 'energy', 'valence', 'acousticness',
            'instrumentalness', 'liveness', 'speechiness', 'loudness'
        ];

        audioFields.forEach(field => {
            const def = schema.find(r => r.Field === field);
            const val = sample ? sample[field] : 'N/A';
            console.log(`${field.padEnd(20)} | Type: ${def?.Type.padEnd(15)} | Sample: ${val}`);
        });

        console.log('\n=== DESCRIPTIVE METADATA ===');
        const descFields = [
            'genre', 'popularity', 'explicit', 'isrc', 'release_date', 'duration'
        ];
        descFields.forEach(field => {
            const def = schema.find(r => r.Field === field);
            const val = sample ? sample[field] : 'N/A';
            console.log(`${field.padEnd(20)} | Type: ${def?.Type.padEnd(15)} | Sample: ${val}`);
        });

        console.log('\n=== COMPLEX METADATA (JSON/Text) ===');
        const complexFields = ['audio_features', 'external_metadata'];
        complexFields.forEach(field => {
            const def = schema.find(r => r.Field === field);
            let val = sample ? sample[field] : 'N/A';
            if (val && val.length > 50) val = val.substring(0, 50) + '...';
            console.log(`${field.padEnd(20)} | Type: ${def?.Type.padEnd(15)} | Sample: ${val}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspectMetadata();
