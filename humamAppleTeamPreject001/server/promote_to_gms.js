import 'dotenv/config'
import { analysisService } from './src/services/analysisService.js'
import { query } from './src/config/db.js'

const TARGET_USER_ID = 3
const SCORE_THRESHOLD = 70

async function promotePlaylists() {
    console.log(`🚀 Starting Batch Promotion to GMS for User ${TARGET_USER_ID}`)
    console.log(`   Threshold: Score >= ${SCORE_THRESHOLD}\n`)

    try {
        const profile = await analysisService.loadProfile(TARGET_USER_ID)
        if (!profile) {
            console.log('❌ User profile not found. Train model first.')
            process.exit(1)
        }

        // Fetch ALL EMS playlists
        const playlists = await query(`
            SELECT playlist_id, title, description 
            FROM playlists 
            WHERE space_type = 'EMS'
        `)

        if (playlists.length === 0) {
            console.log('⚠️ No EMS playlists found to evaluate.')
            process.exit(0)
        }

        console.log(`📊 Evaluating ${playlists.length} candidate playlists...\n`)

        let promotedCount = 0

        for (const p of playlists) {
            const result = await analysisService.evaluatePlaylist(TARGET_USER_ID, p.playlist_id)

            process.stdout.write(`   - [${p.title}] Score: ${result.score} (${result.grade}) ... `)

            if (result.score >= SCORE_THRESHOLD) {
                console.log('✅ PROMOTED!')

                // Move to GMS and set status to PRP (Regular)
                await query(`
                    UPDATE playlists 
                    SET space_type = 'GMS', status_flag = 'PRP', updated_at = CURRENT_TIMESTAMP
                    WHERE playlist_id = ?
                `, [p.playlist_id])

                // Log the score history
                await query(`
                    INSERT INTO playlist_scored_id (playlist_id, user_id, ai_score)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE ai_score = ?
                `, [p.playlist_id, TARGET_USER_ID, result.score, result.score])

                promotedCount++
            } else {
                console.log('❌ Rejected')
            }
        }

        console.log(`\n🎉 Batch Operation Complete`)
        console.log(`   Promoted: ${promotedCount}`)
        console.log(`   Rejected: ${playlists.length - promotedCount}`)

    } catch (e) {
        console.error('Error:', e)
    }
    process.exit()
}

promotePlaylists()
