import 'dotenv/config'
import { query } from './src/config/db.js'

async function checkUser() {
    console.log('🔍 Checking User 3 Credentials...')
    try {
        const users = await query('SELECT user_id, nickname, email, password_hash FROM users WHERE user_id = 3')
        if (users.length === 0) {
            console.log('❌ User 3 not found in DB')
        } else {
            console.log('✅ User 3 found:', users[0])
            console.log('   (Note: Password hash is shown, checking verify logic next if needed)')
        }
    } catch (e) {
        console.error('Error:', e)
    }
    process.exit()
}

checkUser()
