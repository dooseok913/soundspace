
import 'dotenv/config'

async function testSpotify() {
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    // 1. Get Token
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
        },
        body: 'grant_type=client_credentials'
    })
    const data = await response.json()
    const token = data.access_token
    console.log('Token:', token ? 'OK' : 'Failed')

    // 2. Test Audio Features for "Shape of You" (7qiZfU4dY1lWllzX7mPBI3)
    const trackId = '7qiZfU4dY1lWllzX7mPBI3'
    console.log(`\nTesting audio-features for ${trackId}...`)

    const res = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!res.ok) {
        console.log('Status:', res.status)
        console.log('Body:', await res.text())
    } else {
        const features = await res.json()
        console.log('Success:', features)
    }
}

testSpotify()
