
import { query, insert } from './src/config/db.js';

async function createTestScenarios() {
    console.log("Creating Test Scenarios (Workout vs Sleep)...");

    try {
        const userId = 1;

        // --- Scenario 1: Workout (High Energy) ---
        console.log("1. Creating 'Power Workout' Playlist...");
        const workoutId = await insert('INSERT INTO playlists (title, description, user_id, source_type, space_type) VALUES (?, ?, ?, ?, ?)', [
            'Power Workout Mix',
            'High energy music for gym',
            userId, 'System', 'PMS'
        ]);

        // Add 5 high energy tracks (Using simulated logic since real DB has nulls)
        // We will manually insert tracks and force their metadata to be high in the export step
        // But for now, let's just picking some likely candidates or random ones
        // In the export step, we will assign them high energy if they belong to this playlist ID for testing purposes
        let workoutTracks = await query("SELECT track_id FROM tracks LIMIT 5");
        for (const t of workoutTracks) {
            await insert('INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)', [workoutId, t.track_id]);
        }

        // --- Scenario 2: Sleep (Low Energy) ---
        console.log("2. Creating 'Sleep & Relax' Playlist...");
        const sleepId = await insert('INSERT INTO playlists (title, description, user_id, source_type, space_type) VALUES (?, ?, ?, ?, ?)', [
            'Sleep & Relax',
            'Calm low energy music',
            userId, 'System', 'PMS'
        ]);

        let sleepTracks = await query("SELECT track_id FROM tracks ORDER BY track_id DESC LIMIT 5");
        for (const t of sleepTracks) {
            await insert('INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)', [sleepId, t.track_id]);
        }

        console.log(`Created Scenarios -> Workout ID: ${workoutId}, Sleep ID: ${sleepId}`);
        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

createTestScenarios();
