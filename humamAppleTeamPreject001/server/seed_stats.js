
import { query, execute } from './src/config/db.js';

async function seedStats() {
    console.log('🌱 Starting stats seeding...');

    try {
        // 1. Get all content IDs
        let tracks = await query('SELECT track_id, artist, album FROM tracks');
        let playlists = await query('SELECT playlist_id FROM playlists');

        console.log(`Initial lookup: ${tracks.length} tracks, ${playlists.length} playlists`);

        if (tracks.length === 0) {
            console.log('⚠️ No tracks found. Seeding is not possible without tracks.');
        }

        const artists = [...new Set(tracks.filter(t => t.artist).map(t => t.artist))];
        const albums = [...new Set(tracks.filter(t => t.album).map(t => t.album))];

        console.log(`Found: ${tracks.length} tracks, ${playlists.length} playlists, ${artists.length} artists, ${albums.length} albums`);

        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        // 2. Seed Track Stats
        console.log('Processing tracks...');
        let trackSuccess = 0;
        for (const track of tracks) {
            const performaceTier = Math.random();
            let playCount = 0;
            let viewCount = 0;

            if (performaceTier > 0.95) {
                playCount = rand(10000, 500000);
                viewCount = Math.floor(playCount * 1.2);
            } else if (performaceTier > 0.7) {
                playCount = rand(1000, 10000);
                viewCount = Math.floor(playCount * 1.1);
            } else {
                playCount = rand(10, 1000);
                viewCount = rand(playCount, playCount + 100);
            }

            try {
                await execute(`
                    INSERT INTO content_stats (content_type, content_id, play_count, view_count, like_count)
                    VALUES ('track', ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE play_count = VALUES(play_count), view_count = VALUES(view_count)
                `, [track.track_id, playCount, viewCount, Math.floor(playCount * 0.1)]);
                trackSuccess++;
            } catch (e) {
                // console.error(`Failed content_stats for track ${track.track_id}:`, e.message);
            }
        }
        console.log(`✅ Seeded stats for ${trackSuccess} tracks.`);

        // 3. Seed Playlist Stats
        console.log('Processing playlists...');
        let playlistSuccess = 0;
        for (const playlist of playlists) {
            const playCount = rand(50, 5000);
            const viewCount = Math.floor(playCount * 1.5);

            try {
                await execute(`
                    INSERT INTO content_stats (content_type, content_id, play_count, view_count, like_count)
                    VALUES ('playlist', ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE play_count = VALUES(play_count), view_count = VALUES(view_count)
                `, [playlist.playlist_id, playCount, viewCount, Math.floor(playCount * 0.05)]);
                playlistSuccess++;
            } catch (e) {
                // console.error(`Failed content_stats for playlist ${playlist.playlist_id}:`, e.message);
            }
        }
        console.log(`✅ Seeded stats for ${playlistSuccess} playlists.`);

        // 4. Seed Artist Stats
        console.log('Processing artists...');
        let artistSuccess = 0;
        for (const artistName of artists) {
            if (!artistName) continue;

            const performaceTier = Math.random();
            let playCount = 0;

            if (performaceTier > 0.9) {
                playCount = rand(500000, 5000000);
            } else {
                playCount = rand(1000, 100000);
            }
            const viewCount = Math.floor(playCount * 1.3);

            try {
                await execute(`
                    INSERT INTO artist_stats (artist_name, play_count, view_count, like_count)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE play_count = VALUES(play_count), view_count = VALUES(view_count)
                `, [artistName, playCount, viewCount, Math.floor(playCount * 0.2)]);
                artistSuccess++;
            } catch (e) {
                // console.error(`Failed artist_stats for ${artistName}:`, e.message);
            }
        }
        console.log(`✅ Seeded stats for ${artistSuccess} artists.`);

        // 5. Seed Album Stats
        try {
            const dbAlbums = await query('SELECT album_id, title FROM albums');
            console.log(`Found ${dbAlbums.length} albums in albums table.`);

            let albumSuccess = 0;
            if (dbAlbums.length > 0) {
                for (const album of dbAlbums) {
                    const playCount = rand(500, 50000);
                    const viewCount = Math.floor(playCount * 1.2);

                    try {
                        await execute(`
                            INSERT INTO content_stats (content_type, content_id, play_count, view_count, like_count)
                            VALUES ('album', ?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE play_count = VALUES(play_count), view_count = VALUES(view_count)
                        `, [album.album_id, playCount, viewCount, Math.floor(playCount * 0.1)]);
                        albumSuccess++;
                    } catch (e) {
                        // console.error(`Failed content_stats for album ${album.album_id}:`, e.message);
                    }
                }
                console.log(`✅ Seeded stats for ${albumSuccess} albums.`);
            }
        } catch (e) {
            console.log('Error processing albums (table might not exist):', e.message);
        }

        console.log('🎉 Stats seeding process finished.');

    } catch (error) {
        console.error('❌ Seeding failed fatal error:', error);
    } finally {
        process.exit();
    }
}

seedStats();
