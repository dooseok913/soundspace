import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
})

const comments = {
    users: '사용자 회원가입 및 로그인 정보',
    user_platforms: '사용자별 연동된 외부 스트리밍 플랫폼 정보',
    playlists: '플레이리스트 정보 (PMS, EMS, GMS 통합 관리)',
    tracks: '전체 트랙 메타데이터 저장소',
    playlist_tracks: '플레이리스트와 트랙 간의 관계 정의',
    user_track_ratings: '사용자별 트랙 평가',
    ai_analysis_logs: 'AI 취향 분석 및 검증 로그',
    genre_categories: '장르 카테고리 테이블',
    music_genres: 'Spotify 기반 음악 장르 마스터 테이블',
    playlist_scored_id: '사용자별 플레이리스트 평가 점수',
    track_scored_id: '사용자별 트랙 평가 점수',
    track_tags: '트랙 태그 정보',
    user_genres: '사용자별 선호 장르 매핑',
    user_profiles: '사용자 프로필 정보'
}

async function main() {
    for (const [table, comment] of Object.entries(comments)) {
        try {
            const sql = `ALTER TABLE \`${table}\` COMMENT = '${comment.replace(/'/g, "''")}'`
            await pool.query(sql)
            console.log('✅', table)
        } catch (e) {
            console.log('❌', table, e.message)
        }
    }
    await pool.end()
    console.log('완료!')
}

main()
