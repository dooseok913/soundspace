/**
 * Update audio features for PMS tracks using Spotify API
 */

import 'dotenv/config'
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER || 'musicspace',
    password: process.env.DB_PASSWORD || 'musicspace123',
    database: process.env.DB_NAME || 'music_space_db',
    waitForConnections: true,
    connectionLimit: 5
})

// Spotify Token Management
let spotifyToken = null
let spotifyTokenExpiry = 0

async function getSpotifyToken() {
    if (spotifyToken && Date.now() < spotifyTokenExpiry) {
        return spotifyToken
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
        console.error('❌ SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not set.')
        process.exit(1)
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
        },
        body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
        console.error('❌ Spotify Auth Error:', await response.text())
        process.exit(1)
    }

    const data = await response.json()
    spotifyToken = data.access_token
    spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000
    return spotifyToken
}

// Search track on Spotify
async function searchSpotifyTrack(title, artist) {
    const token = await getSpotifyToken()
    try {
        // Clean title for better search (remove "Remastered", "(feat...)", etc if needed)
        // For now, simple search
        const query = encodeURIComponent(`track:${title} artist:${artist}`)
        const res = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        return data.tracks?.items?.[0] || null
    } catch (e) {
        return null
    }
}

// Batch get audio features
async function getBatchAudioFeatures(spotifyIds) {
    if (!spotifyIds.length) return []
    const token = await getSpotifyToken()
    try {
        const url = `https://api.spotify.com/v1/audio-features?ids=${spotifyIds.join(',')}`;
        console.log(`\n🔍 Fetching features from: ${url}`);

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()

        if (data.error) {
            console.error('❌ Spotify API Error:', data.error);
        }

        const features = data.audio_features || [];
        console.log(`   Received ${features.length} feature objects.`);
        return features;
    } catch (e) {
        console.error('❌ Fetch Error:', e);
        return []
    }
}

// Update track in database
async function updateTrack(trackId, spotifyData, features) {
    const updates = []
    const values = []

    if (spotifyData) {
        updates.push('spotify_id = ?')
        values.push(spotifyData.id)

        updates.push('popularity = ?')
        values.push(spotifyData.popularity)

        if (spotifyData.album?.release_date) {
            updates.push('release_date = ?')
            let releaseDate = spotifyData.album.release_date
            if (releaseDate.length === 4) releaseDate += '-01-01'
            else if (releaseDate.length === 7) releaseDate += '-01'
            values.push(releaseDate)
        }
    }

    if (features) {
        updates.push('tempo = ?'); values.push(features.tempo)
        updates.push('energy = ?'); values.push(features.energy)
        updates.push('valence = ?'); values.push(features.valence)
        updates.push('danceability = ?'); values.push(features.danceability)
        updates.push('acousticness = ?'); values.push(features.acousticness)
        updates.push('instrumentalness = ?'); values.push(features.instrumentalness)
        updates.push('liveness = ?'); values.push(features.liveness)
        updates.push('speechiness = ?'); values.push(features.speechiness)
        updates.push('loudness = ?'); values.push(features.loudness)
    }

    if (updates.length === 0) return false

    values.push(trackId)
    const sql = `UPDATE tracks SET ${updates.join(', ')} WHERE track_id = ?`

    await pool.execute(sql, values)
    return true
}

async function main() {
    console.log('🎵 Updating PMS Track Features via Spotify...\n')

    // 1. Find PMS tracks with missing audio features
    const [tracks] = await pool.execute(`
        SELECT DISTINCT t.track_id, t.title, t.artist
        FROM playlists p
        JOIN playlist_tracks pt ON p.playlist_id = pt.playlist_id
        JOIN tracks t ON pt.track_id = t.track_id
        WHERE p.space_type = 'PMS'
          AND (t.tempo IS NULL OR t.energy IS NULL)
        LIMIT 100
    `)

    console.log(`📊 Found ${tracks.length} PMS tracks with missing features.\n`)

    if (tracks.length === 0) {
        console.log('✅ All PMS tracks already have audio features.')
        await pool.end()
        return
    }

    let success = 0
    let failed = 0
    const batchSize = 20

    // Process in batches
    for (let i = 0; i < tracks.length; i += batchSize) {
        const batch = tracks.slice(i, i + batchSize)
        const spotifyResults = []

        // Search
        for (const track of batch) {
            process.stdout.write(`   Searching: ${track.title} - ${track.artist}... `)
            const spotifyTrack = await searchSpotifyTrack(track.title, track.artist)

            if (spotifyTrack) {
                console.log(`✅ Found (${spotifyTrack.name})`)
                spotifyResults.push({ track, spotifyTrack })
            } else {
                console.log(`❌ Not Found`)
                failed++
            }
            await new Promise(r => setTimeout(r, 100)) // Rate limit
        }

        // Fetch Features
        const spotifyIds = spotifyResults.map(r => r.spotifyTrack.id)
        let featuresMap = {}

        if (spotifyIds.length > 0) {
            const features = await getBatchAudioFeatures(spotifyIds)
            features.forEach(f => {
                if (f) featuresMap[f.id] = f
            })
        }

        // Update DB
        for (const { track, spotifyTrack } of spotifyResults) {
            const features = featuresMap[spotifyTrack.id]
            if (features) {
                await updateTrack(track.track_id, spotifyTrack, features)
                success++
            } else {
                failed++
            }
        }
    }

    console.log(`\n🎉 Done! Success: ${success}, Failed: ${failed}\n`)

    // Dump final results for these tracks
    if (success > 0) {
        const trackIds = tracks.map(t => t.track_id).join(',')
        const [updatedRows] = await pool.execute(`
            SELECT title, artist, tempo, energy, valence
            FROM tracks
            WHERE track_id IN (${trackIds})
            AND tempo IS NOT NULL
        `)
        console.log('--- Updated Tracks ---')
        console.table(updatedRows)
    }

    await pool.end()
}

main().catch(console.error)
