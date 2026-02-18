
import json
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
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
    print("Loading data...")
    data_path = os.path.join(os.path.dirname(__file__), 'training_data.json')
    playlists = load_data(data_path)

    if not playlists:
        print("No playlist data found.")
        return

    # Prepare corpus for TF-IDF
    # We combine all track names & artists in a playlist into a single string document
    documents = []
    ids = []
    types = []
    titles = []

    for p in playlists:
        # Combine all tracks text
        playlist_text = " ".join([t['text'] for t in p['tracks']])
        documents.append(playlist_text)
        ids.append(p['playlist_id'])
        types.append(p['type'])
        titles.append(p['title'])

    print(f"Training TF-IDF model on {len(documents)} playlists...")
    
    # Initialize TF-IDF Vectorizer
    vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
    tfidf_matrix = vectorizer.fit_transform(documents)
    
    # Identify Target (User) Playlists
    user_indices = [i for i, t in enumerate(types) if t == 'PMS']
    
    if not user_indices:
        print("No User playlists (PMS) found to recommend for.")
        return

    print(f"Found {len(user_indices)} User playlists. Generating recommendations...")

    for user_idx in user_indices:
        user_vector = tfidf_matrix[user_idx]
        user_title = titles[user_idx]
        
        # Calculate cosine similarity with all other playlists
        cosine_sim = cosine_similarity(user_vector, tfidf_matrix).flatten()
        
        # Sort by similarity score (descending)
        # We want to exclude the user playlist itself
        related_indices = cosine_sim.argsort()[::-1]
        
        print(f"\nRecommendations for User Playlist: '{user_title}'")
        print("-" * 50)
        
        count = 0
        for idx in related_indices:
            if idx == user_idx:
                continue
            
            # Recommendation must be EMS (Platform)
            if types[idx] != 'EMS':
                continue
                
            score = cosine_sim[idx]
            print(f"Rank {count+1}: '{titles[idx]}' (Score: {score:.4f})")
            
            # Show top 3 tracks to verify 'vibe'
            top_tracks = playlists[idx]['tracks'][:3]
            track_strs = [f"{t['title']} - {t['artist']}" for t in top_tracks]
            print(f"   Top Tracks: {', '.join(track_strs)}...")
            
            count += 1
            if count >= 5:
                break

if __name__ == "__main__":
    train_model()
