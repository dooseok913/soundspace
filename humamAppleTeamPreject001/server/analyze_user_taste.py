
import csv
import numpy as np
import sys
import os
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

def analyze_taste():
    print("Analyzing User Music Taste for 'jowoosung21'...")
    csv_path = os.path.join(os.path.dirname(__file__), 'jowoosung_tracks.csv')

    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        sys.exit(1)

    # Data Containers
    features = {
        'Tempo': [],
        'Energy': [],
        'Valence': [],
        'Danceability': [],
        'Acousticness': [],
        'Instrumentalness': [],
        'Popularity': []
    }
    genres = []
    artists = []
    
    # Read CSV
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                try:
                    # Helper to safely float conversion
                    def safe_float(key):
                        val = row.get(key, '')
                        return float(val) if val and val.strip() != '' else None

                    # Helper to safely int conversion
                    def safe_int(key):
                        val = row.get(key, '')
                        return int(val) if val and val.strip() != '' else None

                    t = safe_float('Tempo (BPM)')
                    e = safe_float('Energy')
                    v = safe_float('Valence')
                    d = safe_float('Danceability')
                    a = safe_float('Acousticness')
                    i = safe_float('Instrumentalness')
                    p = safe_int('Popularity')

                    if t is not None: features['Tempo'].append(t)
                    if e is not None: features['Energy'].append(e)
                    if v is not None: features['Valence'].append(v)
                    if d is not None: features['Danceability'].append(d)
                    if a is not None: features['Acousticness'].append(a)
                    if i is not None: features['Instrumentalness'].append(i)
                    if p is not None: features['Popularity'].append(p)

                    g = row.get('Genre', '').strip().replace('"', '')
                    if g: genres.append(g)
                    
                    art = row.get('Artist', '').strip().replace('"', '')
                    if art: artists.append(art)
                    
                    count += 1
                except ValueError:
                    continue # Skip bad rows

            print(f"Processed {count} tracks successfully.\n")
            
            if count == 0:
                print("No valid track data found to analyze.")
                return

            # --- Generate Report ---
            print("=== 🎵 User Music Profile Report ===")
            
            # 1. Feature Stats
            print("\n[1] Audio Features Analysis (Average):")
            avgs = {}
            for name, values in features.items():
                if values:
                    avg = np.mean(values)
                    std = np.std(values)
                    avgs[name] = avg
                    print(f"   - {name}: {avg:.2f} (±{std:.2f})")
            
            # 2. Taste Interpretation
            print("\n[2] Taste Personality:")
            
            # Energy Level
            e = avgs.get('Energy', 0)
            if e > 0.7: print("   🚀 HIGH ENERGY: You love intense, powerful, and active music.")
            elif e < 0.4: print("   🌙 CALM & CHILL: You prefer relaxing, ambient, or soft music.")
            else: print("   ⚖️ BALANCED ENERGY: You listen to a mix of upbeat and mellow tracks.")

            # Mood (Valence)
            v = avgs.get('Valence', 0)
            if v > 0.6: print("   😊 POSITIVE VIBES: Your music tends to be happy, cheerful, or euphoric.")
            elif v < 0.4: print("   😔 MELANCHOLIC: You appreciate sad, angry, or emotional music.")
            else: print("   😐 NEUTRAL MOOD: Your taste is emotionally complex or varied.")

            # Metric: Danceability
            d = avgs.get('Danceability', 0)
            if d > 0.65: print("   💃 DANCER: You like rhythmic music suitable for dancing.")
            
            # Metric: Instrumentalness
            i = avgs.get('Instrumentalness', 0)
            if i > 0.5: print("   🎻 INSTRUMENTALIST: You listen to a lot of music without vocals (Classical, Jazz, OST).")

            # Metric: Popularity
            p = avgs.get('Popularity', 0)
            if p > 70: print("   🔥 TRENDSETTER: You mostly listen to popular, mainstream hits.")
            elif p < 30: print("   💎 DIGGER: You prefer obscure, indie, or niche tracks.")

            # 3. Top Favorites
            print("\n[3] Top Favorites:")
            if genres:
                top_genres = Counter(genres).most_common(5)
                print(f"   🎸 Top Genres: {', '.join([f'{k} ({v})' for k, v in top_genres])}")
            
            if artists:
                top_artists = Counter(artists).most_common(5)
                print(f"   🎤 Top Artists: {', '.join([f'{k} ({v})' for k, v in top_artists])}")

    except Exception as e:
        print(f"Error analyzing data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    analyze_taste()
