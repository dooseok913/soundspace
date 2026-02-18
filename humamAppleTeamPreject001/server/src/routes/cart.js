import express from 'express'
import { query, queryOne, insert, execute } from '../config/db.js'

const router = express.Router()

// 테이블 생성 (없으면)
async function ensureCartTable() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS user_cart (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                track_id INT NULL,
                title VARCHAR(500) NOT NULL,
                artist VARCHAR(500) NOT NULL,
                album VARCHAR(500) DEFAULT '',
                artwork VARCHAR(1000) DEFAULT '',
                preview_url VARCHAR(1000) DEFAULT '',
                external_id VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_track (user_id, title, artist),
                INDEX idx_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        console.log('✅ user_cart table ensured')
    } catch (error) {
        console.error('⚠️ Could not create user_cart table:', error.message)
    }
}

// 서버 시작 시 테이블 확인
ensureCartTable()

// GET /api/cart - 장바구니 조회
router.get('/', async (req, res) => {
    try {
        const userId = req.query.userId || 1
        const cartItems = await query(
            `SELECT id, user_id, track_id, title, artist, album, artwork, preview_url, external_id, created_at 
             FROM user_cart 
             WHERE user_id = ? 
             ORDER BY created_at DESC`,
            [userId]
        )
        res.json({ 
            success: true, 
            cart: cartItems,
            count: cartItems.length
        })
    } catch (error) {
        console.error('Cart fetch error:', error)
        res.status(500).json({ error: error.message })
    }
})

// POST /api/cart - 장바구니에 트랙 추가
router.post('/', async (req, res) => {
    try {
        const { userId = 1, trackId, title, artist, album, artwork, previewUrl, externalId } = req.body

        if (!title || !artist) {
            return res.status(400).json({ error: 'title and artist are required' })
        }

        // 중복 체크
        const existing = await queryOne(
            'SELECT id FROM user_cart WHERE user_id = ? AND title = ? AND artist = ?',
            [userId, title, artist]
        )

        if (existing) {
            return res.status(409).json({ 
                error: 'Track already in cart',
                exists: true,
                cartItemId: existing.id
            })
        }

        const id = await insert(
            `INSERT INTO user_cart (user_id, track_id, title, artist, album, artwork, preview_url, external_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, trackId || null, title, artist, album || '', artwork || '', previewUrl || '', externalId || null]
        )

        res.json({ 
            success: true, 
            message: 'Track added to cart',
            cartItemId: id
        })
    } catch (error) {
        console.error('Cart add error:', error)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Track already in cart', exists: true })
        }
        res.status(500).json({ error: error.message })
    }
})

// DELETE /api/cart/:id - 장바구니에서 트랙 삭제
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.query.userId || 1

        const affected = await execute(
            'DELETE FROM user_cart WHERE id = ? AND user_id = ?',
            [id, userId]
        )

        if (affected === 0) {
            return res.status(404).json({ error: 'Cart item not found' })
        }

        res.json({ success: true, message: 'Track removed from cart' })
    } catch (error) {
        console.error('Cart delete error:', error)
        res.status(500).json({ error: error.message })
    }
})

// DELETE /api/cart - 장바구니 전체 비우기
router.delete('/', async (req, res) => {
    try {
        const userId = req.query.userId || 1

        const affected = await execute(
            'DELETE FROM user_cart WHERE user_id = ?',
            [userId]
        )

        res.json({ 
            success: true, 
            message: 'Cart cleared',
            deletedCount: affected
        })
    } catch (error) {
        console.error('Cart clear error:', error)
        res.status(500).json({ error: error.message })
    }
})

export default router
