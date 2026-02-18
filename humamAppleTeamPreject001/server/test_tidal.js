
import { fetchTidalPlaylistTracks } from './src/routes/tidal.js';
import dotenv from 'dotenv';
dotenv.config();

async function getTidalClientToken() {
    const TIDAL_AUTH_URL = 'https://auth.tidal.com/v1/oauth2/token';
    const clientId = process.env.TIDAL_CLIENT_ID;
    const clientSecret = process.env.TIDAL_CLIENT_SECRET;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(TIDAL_AUTH_URL, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return data.access_token;
}

import { query } from './src/config/db.js';

async function test() {
    try {
        const token = await getTidalClientToken();
        console.log('Token acquired.');

        const p18 = await query("SELECT external_id FROM playlists WHERE playlist_id = 18");
        if (p18.length === 0) {
            console.log('Playlist 18 not found');
            process.exit(1);
        }
        const extId = p18[0].external_id;
        console.log(`Fetching tracks for ${extId}...`);

        const tracks = await fetchTidalPlaylistTracks(token, extId, 'US');
        console.log(`Fetched ${tracks.length} tracks.`);


        // Manual Check for Mix
        console.log('--- Manual Check Mix ---');
        const urlMix = `https://api.tidal.com/v1/mixes/${extId}/items?limit=10&countryCode=US`;
        const resMix = await fetch(urlMix, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.tidal.v1+json' }
        });
        console.log(`Manual Status Mix: ${resMix.status}`);
        if (!resMix.ok) console.log(await resMix.text());

        console.log(`ID Length: ${extId.length}`);

        // Manual Check
        console.log('--- Manual Check ---');
        const url = `https://api.tidal.com/v1/playlists/${extId}/items?limit=10&countryCode=US`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.tidal.v1+json' }
        });
        console.log(`Manual Status: ${res.status}`);
        if (!res.ok) console.log(await res.text());
        else {
            const d = await res.json();
            console.log(`Manual Count: ${d.totalNumberOfItems}`);
        }

    } catch (e) {
        console.error(e);
    }
    process.exit();
}
test();
