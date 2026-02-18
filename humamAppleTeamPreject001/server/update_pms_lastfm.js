
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

const LASTFM_API_KEY = process.env.LASTFM_API_KEY
const LASTFM_BASE_URL = 'http://ws.audioscrobbler.com/2.0/'

async function getTrackInfo(title, artist) {
    if (!LASTFM_API_KEY) throw new Error('LASTFM_API_KEY not set')

    const params = new URLSearchParams({
        method: 'track.getInfo',
        api_key: LASTFM_API_KEY,
        artist: artist,
        track: title,
        format: 'json',
        autocorrect: 1
    })

    try {
        const res = await fetch(`${LASTFM_BASE_URL}?${params}`)
        if (!res.ok) return null

        const data = await res.json()
        return data.track || null // Returns null if track not found
    } catch (e) {
        console.error('Last.fm fetch error:', e.message)
        return null
    }
}

async function updateTrack(trackId, lastfmTrack) {
    // Extract Metadata
    const updates = []
    const values = []

    // 1. Genre (from Top Tags)
    // Last.fm returns tags as { tag: [ {name: 'rock', ...}, ... ] }
    let genre = null
    if (lastfmTrack.toptags && lastfmTrack.toptags.tag && lastfmTrack.toptags.tag.length > 0) {
        // Get top tag
        const tag = Array.isArray(lastfmTrack.toptags.tag)
            ? lastfmTrack.toptags.tag[0].name
            : lastfmTrack.toptags.tag.name

        genre = tag.toLowerCase()
    }

    // 2. Popularity (Normalized approx from listeners)
    // Scale: 0-100. Let's assume 5M listeners = 100, 0 = 0. linear-ish log scale.
    // Or just Raw listeners count? DB 'popularity' is usually 0-100 (Spotify style).
    // Let's map listeners roughly: 
    // >1M = 90-100, >100k=70-90, >10k=50-70, etc.
    let popularity = null
    if (lastfmTrack.listeners) {
        const listeners = parseInt(lastfmTrack.listeners)
        if (listeners > 2000000) popularity = 95
        else if (listeners > 1000000) popularity = 85
        else if (listeners > 500000) popularity = 75
        else if (listeners > 100000) popularity = 65
        else if (listeners > 50000) popularity = 55
        else if (listeners > 10000) popularity = 45
        else if (listeners > 1000) popularity = 30
        else popularity = 10
    }

    // 3. Album
    let album = null
    if (lastfmTrack.album && lastfmTrack.album.title) {
        album = lastfmTrack.album.title
    }

    // 4. Duration (ms)
    let duration = null // seconds
    if (lastfmTrack.duration) {
        // Last.fm mostly returns '0' for duration in some calls, check first
        const d = parseInt(lastfmTrack.duration)
        if (d > 0) duration = Math.round(d / 1000)
    }

    // Construct Update Query
    if (genre) { updates.push('genre = ?'); values.push(genre); }
    if (popularity !== null) { updates.push('popularity = ?'); values.push(popularity); }
    if (album) { updates.push('album = ?'); values.push(album); }
    if (duration) { updates.push('duration = ?'); values.push(duration); }

    // Last.fm URL as external metadata?
    if (lastfmTrack.url) {
        updates.push('external_metadata = ?')
        values.push(JSON.stringify({ lastfm_url: lastfmTrack.url, listeners: lastfmTrack.listeners }))
    }

    if (updates.length > 0) {
        values.push(trackId)
        const sql = `UPDATE tracks SET ${updates.join(', ')} WHERE track_id = ?`
        await pool.execute(sql, values)
        return true
    }
    return false
}

async function main() {
    console.log('📻 Updating PMS tracks from Last.fm API...\n')

    // 1. Get PMS Tracks (ignoring whether they have features/dates - just update what we can)
    // Maybe checking tracks that have NO genre or NO popularity first? 
    // Or simply ALL PMS tracks to improve data quality.
    const [tracks] = await pool.execute(`
        SELECT DISTINCT t.track_id, t.title, t.artist
        FROM playlists p
        JOIN playlist_tracks pt ON p.playlist_id = pt.playlist_id
        JOIN tracks t ON pt.track_id = t.track_id
        WHERE p.space_type = 'PMS'
    `)

    console.log(`Found ${tracks.length} PMS tracks. Starting update...`)

    let processed = 0
    let updated = 0
    let notFound = 0

    for (const track of tracks) {
        processed++
        process.stdout.write(`[${processed}/${tracks.length}] Fetching: ${track.title} - ${track.artist}... `)

        const info = await getTrackInfo(track.title, track.artist)

        if (info) {
            const isUpdated = await updateTrack(track.track_id, info)
            if (isUpdated) {
                console.log(`✅ Updated (${info.name})`)
                updated++
            } else {
                console.log(`⚠️  Found but no new data`)
            }
        } else {
            console.log(`❌ Not Found`)
            notFound++
        }

        // Rate limit: Last.fm allows ~5 request/sec. Let's be safe with 200ms delay.
        await new Promise(r => setTimeout(r, 200))
    }

    console.log(`\n🎉 Done!`)
    console.log(`Total: ${tracks.length}, Updated: ${updated}, Not Found: ${notFound}`)

    await pool.end()
}

main().catch(console.error)
