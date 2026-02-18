import 'dotenv/config'
import { query } from './src/config/db.js'
import bcrypt from 'bcryptjs'

async function resetPassword() {
    console.log('🔄 Resetting User 3 Password...')
    try {
        const salt = await bcrypt.genSalt(10)
        const hash = await bcrypt.hash('password123', salt)

        const result = await query('UPDATE users SET password_hash = ? WHERE user_id = 3', [hash])
        console.log('✅ Password updated for User 3 to: password123')
    } catch (e) {
        console.error('Error:', e)
    }
    process.exit()
}

resetPassword()
