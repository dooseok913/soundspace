
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function collectAndVerify() {
    console.log('🖼️ Starting Artist Image Collection...');
    try {
        // 1. Trigger collection
        console.log('Sending POST to http://localhost:3001/api/training/collect-artist-images ...');
        const collectRes = await fetch('http://localhost:3001/api/training/collect-artist-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 5, forceUpdate: false })
        });

        if (collectRes.ok) {
            const data = await collectRes.json();
            console.log('✅ Collection Triggered');
            console.log(`   Success: ${data.success}, Failed: ${data.failed}`);
            if (data.updated && data.updated.length > 0) {
                console.log('   Updated Artists:', data.updated.slice(0, 3));
            }
        } else {
            console.error(`❌ Collection Failed: ${collectRes.status}`);
            console.error('Response Text:', await collectRes.text());
        }

        // 2. Verify Data via Stats API
        console.log('\n🔎 Verifying Best Artists API...');
        const statsRes = await fetch('http://localhost:3001/api/stats/best/artists?limit=5');
        if (statsRes.ok) {
            const statsData = await statsRes.json();
            console.log('✅ API Response Received');
            statsData.artists.forEach(artist => {
                const status = artist.image ? '✅ Has Image' : '❌ No Image';
                console.log(`   - ${artist.name}: ${status} (${artist.image ? artist.image.substring(0, 30) + '...' : ''})`);
            });
        } else {
            console.error(`❌ Stats API Failed: ${statsRes.status}`);
            console.error('Response Text:', await statsRes.text());
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

collectAndVerify();
