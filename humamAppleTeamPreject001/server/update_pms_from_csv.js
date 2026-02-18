
import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER || 'musicspace',
    password: process.env.DB_PASSWORD || 'musicspace123',
    database: process.env.DB_NAME || 'music_space_db',
    waitForConnections: true,
    connectionLimit: 5
});

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Normalize strings for comparison
function normalize(str) {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/\(.*\)/g, '') // Remove parenthesis content
        .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
        .trim();
}

async function loadDataset() {
    console.log("Loading dataset.csv...");
    const csvPath = path.join(__dirname, 'dataset', 'dataset.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    // Using d3-dsv or similar simple parser logic if library not available?
    // Let's use simple split since we know the structure might be roughly consistent,
    // but a proper parser is safer. 
    // Wait, I don't have d3-dsv installed in the environment most likely.
    // I'll implement a simple CSV parser or rely on line splitting if no quoted newlines.

    // Robust-ish parse
    const rows = [];
    const lines = fileContent.split('\n');
    const header = lines[0].split(',');

    // Feature indices mapping
    // columns: ,track_id,artists,album_name,track_name,popularity,duration_ms,explicit,danceability,energy,key,loudness,mode,speechiness,acousticness,instrumentalness,liveness,valence,tempo,time_signature,track_genre
    const idx = {
        title: header.indexOf('track_name'),
        artist: header.indexOf('artists'),
        tempo: header.indexOf('tempo'),
        energy: header.indexOf('energy'),
        valence: header.indexOf('valence'),
        danceability: header.indexOf('danceability'),
        acousticness: header.indexOf('acousticness'),
        instrumentalness: header.indexOf('instrumentalness'),
        liveness: header.indexOf('liveness'),
        speechiness: header.indexOf('speechiness'),
        loudness: header.indexOf('loudness'),
        spotify_id: header.indexOf('track_id'),
        popularity: header.indexOf('popularity')
    };

    console.log("Parsing lines...");
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle simple CSV splitting (naive, but fast for this dataset structure usually)
        // If titles have commas, this breaks. 
        // Better: use a regex to match CSV.

        // Regex for CSV with quotes support
        const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 5) continue;

        // Clean quotes
        const clean = matches.map(m => m.replace(/^"|"$/g, '').replace(/""/g, '"'));

        // We need specific columns.
        // Wait, index mapping might be off if I rely on matches array which doesn't include empty matches correctly with that regex?
        // Let's rely on the fact that this specific dataset is usually well formed.
        // Or simpler: just try to find the title/artist columns relative to the end if logic is complex.

        // Let's restart with a safer manual parser loop for relevant fields.
        // Just storing needed fields to save memory.

        // Simplified object structure for memory efficiency
        // We'll index by Normalized Title for fast lookup

        // Actually, let's just use `csv-parse` if avail? Probably not.
        // Let's just try to extract audio features if title matches.

        // Re-implementing a simple splitter that respects quotes
        let row = [];
        let current = '';
        let inQuote = false;
        for (let char of line) {
            if (char === '"') { inQuote = !inQuote; }
            else if (char === ',' && !inQuote) { row.push(current); current = ''; }
            else { current += char; }
        }
        row.push(current);

        if (row.length < 20) continue; // Malformed line

        rows.push({
            title: row[idx.title],
            artist: row[idx.artist],
            metadata: {
                album: row[6], // idx isn't robust for all fields, using index for known structure (idx object above missed some)
                // Wait, headers order:
                // ,track_id,artists,album_name,track_name,popularity,duration_ms,explicit,danceability...
                // 0:rowid, 1:track_id, 2:artists, 3:album_name, 4:track_name, 5:popularity, 6:duration_ms, 7:explicit
                // Let's use idx correctly if possible, or just robust manual mapping from header check
                album: row[header.indexOf('album_name')],
                genre: row[header.indexOf('track_genre')],
                duration: parseInt(row[header.indexOf('duration_ms')]) || 0,
                explicit: row[header.indexOf('explicit')] === 'True' || row[header.indexOf('explicit')] === 'true' ? 1 : 0
            },
            features: {
                tempo: parseFloat(row[idx.tempo]),
                energy: parseFloat(row[idx.energy]),
                valence: parseFloat(row[idx.valence]),
                danceability: parseFloat(row[idx.danceability]),
                acousticness: parseFloat(row[idx.acousticness]),
                instrumentalness: parseFloat(row[idx.instrumentalness]),
                liveness: parseFloat(row[idx.liveness]),
                speechiness: parseFloat(row[idx.speechiness]),
                loudness: parseFloat(row[idx.loudness]),
                spotify_id: row[idx.spotify_id],
                popularity: parseInt(row[idx.popularity])
            }
        });
    }
    console.log(`Loaded ${rows.length} tracks.`);
    return rows;
}

async function updateTrack(trackId, data) {
    const sql = `
        UPDATE tracks SET 
            tempo = ?, energy = ?, valence = ?, danceability = ?, 
            acousticness = ?, instrumentalness = ?, liveness = ?, speechiness = ?, loudness = ?,
            spotify_id = ?, popularity = ?,
            album = ?, genre = ?, duration = ?, explicit = ?
        WHERE track_id = ?
    `;
    // Duration in DB is seconds, CSV is ms
    const durationSeconds = Math.round(data.metadata.duration / 1000);

    const values = [
        data.features.tempo, data.features.energy, data.features.valence, data.features.danceability,
        data.features.acousticness, data.features.instrumentalness, data.features.liveness, data.features.speechiness, data.features.loudness,
        data.features.spotify_id, data.features.popularity,
        data.metadata.album, data.metadata.genre, durationSeconds, data.metadata.explicit,
        trackId
    ];
    await pool.execute(sql, values);
}

async function main() {
    console.log("🚀 Updating PMS tracks from Local Dataset...");

    // 1. Get PMS Tracks
    const [pmsTracks] = await pool.execute(`
        SELECT DISTINCT t.track_id, t.title, t.artist
        FROM playlists p
        JOIN playlist_tracks pt ON p.playlist_id = pt.playlist_id
        JOIN tracks t ON pt.track_id = t.track_id
        WHERE p.space_type = 'PMS'
    `);

    console.log(`Checking ${pmsTracks.length} tracks against dataset...`);

    if (pmsTracks.length === 0) {
        console.log("No PMS tracks need updating.");
        process.exit(0);
    }

    // 2. Load Dataset
    const dataset = await loadDataset();

    // 3. Match and Update
    let updated = 0;

    // Optimization: Create a Map of normalized titles for O(1) lookup
    const datasetMap = new Map();
    for (const d of dataset) {
        const normTitle = normalize(d.title);
        if (!datasetMap.has(normTitle)) {
            datasetMap.set(normTitle, []);
        }
        datasetMap.get(normTitle).push(d);
    }

    for (const track of pmsTracks) {
        const normTitle = normalize(track.title);
        const normArtist = normalize(track.artist);

        const candidates = datasetMap.get(normTitle);

        let bestMatch = null;

        if (candidates) {
            // Check artist match
            for (const cand of candidates) {
                // Exact artist match (normalized)
                if (normalize(cand.artist).includes(normArtist) || normArtist.includes(normalize(cand.artist))) {
                    bestMatch = cand;
                    break;
                }
                // Fuzzy match?
                if (levenshtein(normalize(cand.artist), normArtist) < 3) {
                    bestMatch = cand;
                    break;
                }
            }
        }

        if (bestMatch) {
            // Found!
            process.stdout.write(`✅ Matched: [${track.title}] -> [${bestMatch.title} / ${bestMatch.artist}]\n`);
            await updateTrack(track.track_id, bestMatch);
            updated++;
        } else {
            console.log(`❌ No match for: ${track.title} - ${track.artist}`);
        }
    }

    console.log(`\n🎉 Finished! Updated ${updated} / ${pmsTracks.length} tracks.`);
    process.exit(0);
}

main().catch(console.error);
