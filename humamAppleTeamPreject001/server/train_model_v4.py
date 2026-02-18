
import json
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler
import sys
import os

def load_data(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: {filepath} not found.")
        sys.exit(1)

def train_model():
    print("Loading data for Model v4.0 (Pure Feature-Based)...")
    data_path = os.path.join(os.path.dirname(__file__), 'training_data_v3.json')
    playlists = load_data(data_path)

    if not playlists:
        return

    # Extract Features Only (Ignore Text)
    feature_vectors = []
    
    ids = []
    types = []
    titles = []

    print("Processing playlist features...")
    
    for p in playlists:
        # Features (Average)
        if p['tracks']:
            feats = [
                [
                    t['features']['tempo'],
                    t['features']['energy'],
                    t['features']['valence'],
                    t['features']['danceability'],
                    t['features']['acousticness'],
                    t['features']['instrumentalness']
                ] 
                for t in p['tracks']
            ]
            # Average columns
            avg_feats = np.mean(feats, axis=0)
            feature_vectors.append(avg_feats)
        else:
            feature_vectors.append([0, 0, 0, 0, 0, 0]) # Empty playlist

        ids.append(p['playlist_id'])
        types.append(p['type'])
        titles.append(p['title'])

    # Normalize Features
    # Since we rely 100% on features, normalization is critical
    print("Normalizing audio features...")
    scaler = MinMaxScaler()
    feature_matrix = scaler.fit_transform(feature_vectors)

    # Calculate Similarity (Cosine)
    # Pure Feature Match
    print("Calculating feature similarity...")
    feat_sim = cosine_similarity(feature_matrix)
    
    # Generate Recommendations
    user_indices = [i for i, t in enumerate(types) if t == 'PMS']
    
    if not user_indices:
        print("No User playlists found.")
        return

    print(f"\nFound {len(user_indices)} User playlists. Generating Feature-Based Recommendations...")

    for user_idx in user_indices:
        user_title = titles[user_idx]
        
        # Get scores for this user
        scores = feat_sim[user_idx]
        
        # Sort
        related_indices = scores.argsort()[::-1]
        
        print(f"\nRecommendations for User Playlist: '{user_title}'")
        print("-" * 50)
        
        avg_user_feats = feature_vectors[user_idx]
        print(f"   [User Vibe] Tempo: {avg_user_feats[0]:.1f}, Energy: {avg_user_feats[1]:.2f}, Valence: {avg_user_feats[2]:.2f}")
        
        count = 0
        for idx in related_indices:
            if idx == user_idx:
                continue
            
            if types[idx] != 'EMS':
                continue
                
            score = scores[idx]
            
            # Show top results
            print(f"Rank {count+1}: '{titles[idx]}' (Score: {score:.4f})")
            
            # Show vibe comparison
            f = feature_vectors[idx]
            print(f"   [Vibe] Tempo: {f[0]:.1f}, Energy: {f[1]:.2f}, Valence: {f[2]:.2f}")
            
            count += 1
            if count >= 3:
                break

if __name__ == "__main__":
    train_model()
