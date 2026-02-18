
import csv
import os
import sys
import numpy as np
import random
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler

# --- Configuration ---
USER_TRACKS_FILE = 'jowoosung_tracks.csv'
GLOBAL_DATASET_FILE = './dataset/dataset.csv'
DUMMY_DATASET_SIZE = 10000  # Generate 10k dummy tracks if file missing

def load_csv_data(filepath):
    """Loads track data from CSV. Returns list of dicts."""
    data = []
    if not os.path.exists(filepath):
        return None
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append(row)
    return data

def generate_dummy_global_dataset(filepath, size):
    """Generates a dummy dataset of tracks for demonstration."""
    print(f"Creating dummy global dataset with {size} tracks at {filepath}...")
    genres = ['Pop', 'Rock', 'Jazz', 'Classical', 'Hip-Hop', 'EDM', 'Indie', 'R&B']
    
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['id', 'name', 'artist', 'genre', 'tempo', 'energy', 'valence', 'danceability', 'acousticness', 'instrumentalness', 'popularity']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for i in range(size):
            genre = random.choice(genres)
            # Simulate feature correlation with genre
            if genre == 'EDM':
                energy = random.uniform(0.7, 1.0)
                valence = random.uniform(0.5, 0.9)
            elif genre == 'Jazz':
                energy = random.uniform(0.3, 0.6)
                valence = random.uniform(0.4, 0.7)
            elif genre == 'Classical':
                energy = random.uniform(0.1, 0.4)
                valence = random.uniform(0.2, 0.5)
            else:
                energy = random.uniform(0, 1)
                valence = random.uniform(0, 1)

            writer.writerow({
                'id': f'global_{i}',
                'name': f'Track {i}',
                'artist': f'Artist {random.randint(1, 1000)}',
                'genre': genre,
                'tempo': random.uniform(60, 180),
                'energy': energy,
                'valence': valence,
                'danceability': random.uniform(0, 1),
                'acousticness': random.uniform(0, 1),
                'instrumentalness': random.uniform(0, 1),
                'popularity': random.randint(0, 100)
            })
    print("Dummy dataset created.")

def safe_float(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0

def train_and_recommend():
    base_dir = os.path.dirname(__file__)
    user_csv_path = os.path.join(base_dir, USER_TRACKS_FILE)
    global_csv_path = os.path.join(base_dir, GLOBAL_DATASET_FILE)

    # 1. Load User Data
    print(f"Loading user data from {USER_TRACKS_FILE}...")
    user_tracks = load_csv_data(user_csv_path)
    if not user_tracks:
        print("Error: User track data not found. Run export_user_tracks_csv.js first.")
        sys.exit(1)

    # 2. Extract User Profile Vector
    print(f"Building user profile from {len(user_tracks)} tracks...")
    user_features_list = []
    user_track_ids = set()

    # Mapping CSV headers to standard feature names
    feature_keys = ['tempo', 'energy', 'valence', 'danceability', 'acousticness', 'instrumentalness', 'popularity']
    # Note: user_tracks csv might have capitalized headers or different names.
    # Let's handle 'Tempo (BPM)' vs 'tempo', etc.
    
    def get_feature_vector(row):
        # Flexible key lookup
        t = safe_float(row.get('Tempo (BPM)') or row.get('tempo'))
        e = safe_float(row.get('Energy') or row.get('energy'))
        v = safe_float(row.get('Valence') or row.get('valence'))
        d = safe_float(row.get('Danceability') or row.get('danceability'))
        a = safe_float(row.get('Acousticness') or row.get('acousticness'))
        i = safe_float(row.get('Instrumentalness') or row.get('instrumentalness'))
        p = safe_float(row.get('Popularity') or row.get('popularity'))
        return [t, e, v, d, a, i, p]

    for row in user_tracks:
        vec = get_feature_vector(row)
        user_features_list.append(vec)
        # Store ID to avoid recommending same songs (Discovery Mode)
        # Assuming 'Spotify ID' or 'Track ID' exists
        tid = row.get('Spotify ID') or row.get('Track ID') or row.get('id') or row.get('track_id')
        if tid: user_track_ids.add(tid)

    if not user_features_list:
        print("No valid audio features found in user data.")
        sys.exit(1)

    user_profile_vector = np.mean(user_features_list, axis=0).reshape(1, -1)
    print(f"User Profile Vector (Avg): {user_profile_vector}")

    # 3. Load Global Data (Candidate Pool)
    if not os.path.exists(global_csv_path):
        print(f"'{GLOBAL_DATASET_FILE}' not found. Generating dummy dataset for demonstration...")
        generate_dummy_global_dataset(global_csv_path, DUMMY_DATASET_SIZE)

    print(f"Loading global candidate pool from {GLOBAL_DATASET_FILE}...")
    global_tracks = load_csv_data(global_csv_path)
    
    global_features_list = []
    global_meta_list = []

    for row in global_tracks:
        vec = get_feature_vector(row)
        global_features_list.append(vec)
        global_meta_list.append(row)

    if not global_features_list:
        print("Global dataset is empty.")
        sys.exit(1)

    X_global = np.array(global_features_list)

    # 4. Standardize Data (Crucial for distance metrics)
    print("Normalizing features...")
    scaler = StandardScaler()
    # Fit on GLOBAL data to understand the "world" distribution
    scaler.fit(X_global) 
    
    X_global_scaled = scaler.transform(X_global)
    user_profile_scaled = scaler.transform(user_profile_vector)

    # 5. Calculate Similarity
    print("Calculating similarities...")
    similarities = cosine_similarity(user_profile_scaled, X_global_scaled).flatten()

    # 6. Rank and Filter
    # Get indices of sorted similarities (descending)
    sorted_indices = similarities.argsort()[::-1]

    recommendations = []
    print("\nfiltering known tracks...")
    
    for idx in sorted_indices:
        track = global_meta_list[idx]
        tid = track.get('track_id') or track.get('id') or track.get('Spotify ID')
        
        # Discovery Filter: Skip if user already knows this track
        if tid in user_track_ids:
            continue
            
        sim_score = similarities[idx]
        track['similarity_score'] = sim_score
        recommendations.append(track)
        
        if len(recommendations) >= 20:
            break

    # 7. Write Results to File
    output_file = os.path.join(base_dir, "v5_results.txt")
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n=== 🔮 Model v5.0 Discovery Recommendations ===\n")
        f.write("Based on User Profile: Calm & Melancholic (Derived from History)\n")
        f.write(f"Scanning {len(global_tracks)} candidates...\n\n")

        f.write(f"{'Rank':<5} | {'Score':<6} | {'Genre':<15} | {'Title':<40} | {'Artist'}\n")
        f.write("-" * 100 + "\n")
        for i, track in enumerate(recommendations):
            title = (track.get('track_name') or track.get('name') or track.get('Title') or 'Unknown')[:38]
            artist = (track.get('artists') or track.get('artist') or track.get('Artist') or 'Unknown')[:25]
            genre = (track.get('track_genre') or track.get('genre') or track.get('Genre') or 'Unknown')[:15]
            score = track['similarity_score']
            line = f"{i+1:<5} | {score:.4f} | {genre:<15} | {title:<40} | {artist}\n"
            f.write(line)
            print(line.strip())
            
    print(f"Results saved to {output_file}")

if __name__ == "__main__":
    train_and_recommend()
