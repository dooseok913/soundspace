
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function verifyApis() {
    console.log('🌐 Verifying External APIs...');

    // 1. iTunes
    try {
        console.log('Testing iTunes API...');
        const res = await fetch('http://localhost:3001/api/itunes/search?term=Global+Top+100&limit=5&media=music&entity=song');
        if (res.ok) {
            const data = await res.json();
            console.log(`✅ iTunes Success: Found ${data.results?.length} items.`);
        } else {
            console.error(`❌ iTunes Failed: ${res.status}`);
        }
    } catch (e) {
        console.error('❌ iTunes Error:', e.message);
    }

    // 2. Tidal (Skipping for brevity in this test, focusing on YouTube)

    // 3. YouTube (API Key via Backend Route)
    try {
        console.log('Testing YouTube API Route...');

        // Test frontend-style call
        const res = await fetch(`http://localhost:3001/api/youtube/search?q=Billboard+Hot+100&maxResults=5`);
        if (res.ok) {
            const data = await res.json();
            if (data.playlists && data.playlists.length > 0) {
                console.log(`✅ YouTube Success: Found ${data.playlists.length} items (frontend format).`);
                console.log('Sample item:', data.playlists[0]);
            } else {
                console.log('⚠️ YouTube API ok but no playlists/items returned.');
                console.log('Response:', data);
            }

            // Test legacy single match
            const legacyRes = await fetch(`http://localhost:3001/api/youtube/search?query=Seven+Jungkook`);
            if (legacyRes.ok) {
                const legacyData = await legacyRes.json();
                if (legacyData.youtubeId) {
                    console.log(`✅ YouTube Legacy Success: Found ${legacyData.title}`);
                }
            }

        } else {
            const err = await res.text();
            console.error(`❌ YouTube Failed: ${res.status}`, err);
        }

    } catch (e) {
        console.error('❌ YouTube Error:', e.message);
    }
}

verifyApis();
