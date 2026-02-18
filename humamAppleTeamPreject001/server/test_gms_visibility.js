import 'dotenv/config'
import { query } from './src/config/db.js'

const TARGET_USER_ID = 3

async function verifyGMS() {
    console.log(`🔍 Verifying GMS Playlists for User ${TARGET_USER_ID}...\n`)

    try {
        // Simulate GET /api/playlists?userId=3&spaceType=GMS
        // The API logic: SELECT ... FROM playlists WHERE user_id = ? AND space_type = ?
        const playlists = await query(`
            SELECT p.playlist_id, p.title, p.space_type, p.status_flag, psi.ai_score
            FROM playlists p
            LEFT JOIN playlist_scored_id psi ON p.playlist_id = psi.playlist_id AND psi.user_id = p.user_id
            WHERE p.user_id = ? AND p.space_type = 'GMS'
        `, [TARGET_USER_ID])

        console.log(`📋 Found ${playlists.length} playlists in GMS:\n`)

        let foundTarget = false
        playlists.forEach(p => {
            console.log(`   - [${p.playlist_id}] ${p.title}`)
            console.log(`     Status: ${p.status_flag}`)
            console.log(`     AI Score: ${p.ai_score || 'N/A'}`)

            if (p.title.includes('Vocal Jazz Essentials')) {
                foundTarget = true
                console.log('     ✨ THIS IS THE PROMOTED PLAYLIST!')
            }
            console.log('')
        })

        if (foundTarget) {
            console.log('✅ TEST PASSED: Promoted playlist is visible in GMS.')
        } else {
            console.log('❌ TEST FAILED: Promoted playlist NOT found in GMS.')
        }

    } catch (e) {
        console.error('Error:', e)
    }
    process.exit()
}

verifyGMS()
