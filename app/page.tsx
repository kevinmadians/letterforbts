'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Letter } from './types/Letter';
import { db } from './firebase/config';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  Timestamp,
  where,
  limit,
  startAfter,
  getDocs,
  updateDoc,
  doc,
  increment,
  arrayUnion,
  arrayRemove,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Masonry from 'react-masonry-css';
import SpotifySearch from './components/SpotifySearch';
import SpotifyPlayer from '@/app/components/SpotifyPlayer';

type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
};

const membersList = ['BTS', 'RM', 'Jin', 'Suga', 'J-Hope', 'Jimin', 'V', 'Jungkook'];
const colorClasses = ['card-1', 'card-2', 'card-3', 'card-4', 'card-5', 'card-6'];
const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'mostLoved', label: 'Most Loved' }
];

export default function Home() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [name, setName] = useState('');
  const [member, setMember] = useState(membersList[0]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter states
  const [selectedMember, setSelectedMember] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastLetterRef = useRef<HTMLDivElement | null>(null);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const LETTERS_PER_PAGE = 12;

  const router = useRouter();

  const [likedLetters, setLikedLetters] = useState<Set<string>>(new Set());
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);

  useEffect(() => {
    const savedLikes = localStorage.getItem('likedLetters');
    if (savedLikes) {
      setLikedLetters(new Set(JSON.parse(savedLikes)));
    }
  }, []);

  useEffect(() => {
    try {
      setIsLoading(true);
      setHasMore(true);
      lastDocRef.current = null;
      const lettersRef = collection(db, 'letters');
      
      const queryConstraints = [];
      
      if (selectedMember !== 'all') {
        queryConstraints.push(where('member', '==', selectedMember));
      }
      
      if (sortOrder === 'mostLoved') {
        queryConstraints.push(orderBy('likes', 'desc'));
        queryConstraints.push(orderBy('timestamp', 'desc'));
      } else {
        queryConstraints.push(orderBy('timestamp', sortOrder === 'newest' ? 'desc' : 'asc'));
      }
      
      queryConstraints.push(limit(LETTERS_PER_PAGE));
      
      const q = query(lettersRef, ...queryConstraints);
      
      const unsubscribe = onSnapshot(
        q, 
        (snapshot) => {
          const fetchedLetters = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Letter[];
          
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
          setLetters(fetchedLetters);
          setHasMore(snapshot.docs.length === LETTERS_PER_PAGE);
          setIsLoading(false);
        },
        (error) => {
          console.error("Error fetching letters:", error);
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up Firebase listener:", error);
      setIsLoading(false);
    }
  }, [selectedMember, sortOrder]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || isLoading) return;

    try {
      setLoadingMore(true);
      const lettersRef = collection(db, 'letters');
      
      const queryConstraints = [];
      
      if (selectedMember !== 'all') {
        queryConstraints.push(where('member', '==', selectedMember));
      }
      
      if (sortOrder === 'mostLoved') {
        queryConstraints.push(orderBy('likes', 'desc'));
        queryConstraints.push(orderBy('timestamp', 'desc'));
      } else {
        queryConstraints.push(orderBy('timestamp', sortOrder === 'newest' ? 'desc' : 'asc'));
      }
      
      queryConstraints.push(startAfter(lastDocRef.current));
      queryConstraints.push(limit(LETTERS_PER_PAGE));
      
      const q = query(lettersRef, ...queryConstraints);
      const snapshot = await getDocs(q);
      
      const newLetters = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Letter[];

      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      setLetters(prev => [...prev, ...newLetters]);
      setHasMore(snapshot.docs.length === LETTERS_PER_PAGE);
    } catch (error) {
      console.error("Error loading more letters:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, isLoading, selectedMember, sortOrder]);

  const lastLetterElementRef = useCallback((node: HTMLDivElement) => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observerRef.current.observe(node);
  }, [hasMore, loadMore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const colorClass = colorClasses[Math.floor(Math.random() * colorClasses.length)];
      const letterData = {
        name,
        member,
        message,
        timestamp: Timestamp.now(),
        colorClass,
        likes: 0,
        likedBy: [],
        ...(selectedTrack && {
          spotifyTrack: {
            id: selectedTrack.id,
            name: selectedTrack.name,
            artist: selectedTrack.artists[0]?.name,
            albumCover: selectedTrack.album.images[0]?.url
          }
        })
      };

      const docRef = await addDoc(collection(db, 'letters'), letterData);
      
      setName('');
      setMessage('');
      setMember(membersList[0]);
      setSelectedMember(member);
      
    } catch (error) {
      console.error('Error adding letter:', error);
      alert('Failed to send letter. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMemberFilter = (member: string) => {
    console.log('Filtering for member:', member);
    setSelectedMember(member);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOrder(e.target.value);
  };

  const handleLike = async (e: React.MouseEvent, letterId: string) => {
    e.stopPropagation();
    const userId = localStorage.getItem('userId') || crypto.randomUUID();
    
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', userId);
    }

    try {
      const letterRef = doc(db, 'letters', letterId);
      const isLiked = likedLetters.has(letterId);

      await updateDoc(letterRef, {
        likes: increment(isLiked ? -1 : 1),
        likedBy: isLiked ? arrayRemove(userId) : arrayUnion(userId)
      });

      const newLikedLetters = new Set(likedLetters);
      if (isLiked) {
        newLikedLetters.delete(letterId);
      } else {
        newLikedLetters.add(letterId);
      }
      setLikedLetters(newLikedLetters);
      
      localStorage.setItem('likedLetters', JSON.stringify([...newLikedLetters]));

    } catch (error) {
      console.error('Error updating likes:', error);
    }
  };

  return (
    <main className="min-h-screen bg-white py-8">
      <div className="text-center max-w-4xl mx-auto mb-6 px-4">
        <button 
          onClick={() => router.push('/')} 
          className="font-reenie font-bold text-6xl mb-4 animate-fade-in text-gray-800 hover:text-[#9333EA] transition-colors duration-300"
        >
          Love for BTS
        </button>
        <p className="text-gray-600 italic text-base">
          Pour your love for BTS into words that inspire and unite ARMYs worldwide
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mb-8">
        <div className="bg-[#9333EA]/10 border border-[#9333EA]/20 rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[#9333EA] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[#9333EA]/90 leading-relaxed">
              Dear ARMY! Please share your message with care! Also avoid including any sensitive or personal information like phone numbers, addresses, or any private things. Please use appropriate language. 
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4">
        <div className="mb-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#9333EA] focus:border-transparent outline-none"
          />
        </div>

        <div className="mb-3">
          <select
            value={member}
            onChange={(e) => setMember(e.target.value)}
            required
            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#9333EA] focus:border-transparent outline-none"
          >
            {membersList.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message..."
            required
            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#9333EA] focus:border-transparent outline-none resize-none h-32"
          />
        </div>

        <div className="mb-8">
          <SpotifySearch
            onSelect={(track) => {
              setSelectedTrack(track);
            }}
            selectedTrack={selectedTrack}
            required={false}
          />
        </div>

        <div className="flex justify-center mt-6 mb-16 sm:mb-8">
          <button
            type="submit"
            disabled={isSubmitting || !selectedTrack || !name || !message || !member}
            className={`w-[85%] sm:w-auto bg-[#9333EA] text-white px-8 py-3.5 rounded-full font-medium 
              transition-all duration-300 transform hover:scale-105 
              ${(isSubmitting || !selectedTrack || !name || !message || !member) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#7928CA]'}`}
          >
            {isSubmitting ? 'Sending...' : 'Send Letter'}
          </button>
        </div>
      </form>

      <div className="max-w-7xl mx-auto mb-12 px-4 mt-4">
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-wrap justify-center gap-3 w-full">
            <button
              onClick={() => handleMemberFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors
                ${selectedMember === 'all' 
                  ? 'bg-[#9333EA] text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All
            </button>
            {membersList.map((m) => (
              <button
                key={m}
                onClick={() => handleMemberFilter(m)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors
                  ${selectedMember === m 
                    ? 'bg-[#9333EA] text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {m}
              </button>
            ))}
          </div>

          <select
            value={sortOrder}
            onChange={handleSortChange}
            className="w-[90%] sm:w-auto bg-white text-gray-600 px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#9333EA] focus:border-transparent outline-none"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="heart-loading"></div>
          </div>
        ) : letters.length > 0 ? (
          <Masonry
            breakpointCols={{
              default: 4,
              1280: 3,
              1024: 2,
              768: 2,
              640: 1
            }}
            className="masonry-grid"
            columnClassName="masonry-grid_column"
          >
            {letters.map((letter, index) => (
              <div
                key={letter.id}
                ref={index === letters.length - 1 ? lastLetterElementRef : undefined}
                className={`letter-card ${letter.colorClass}`}
                onClick={() => router.push(`/letter/${letter.id}`)}
              >
                <div className="flex flex-col h-full">
                  <div className="mb-3">
                    <h3 className="text-xl font-bold mb-2">
                      To: {letter.member}
                    </h3>
                    <div className="w-12 h-0.5 bg-white/30 rounded-full mb-3" />
                    <p className="letter-card-content text-white/90">
                      {letter.message}
                    </p>
                  </div>

                  <div className="mt-auto">
                    {letter.spotifyTrack && (
                      <div className="mt-4 pt-4 border-t border-white/20">
                        <p className="text-center italic text-xs text-white/80 mb-2">Favorite song</p>
                        <div className="flex items-center gap-2 justify-center">
                          <img 
                            src={letter.spotifyTrack.albumCover}
                            alt={letter.spotifyTrack.name}
                            className="w-10 h-10 rounded-md"
                          />
                          <div>
                            <p className="font-medium text-white text-xs truncate max-w-[150px]">
                              {letter.spotifyTrack.name}
                            </p>
                            <p className="text-[10px] text-white/80 truncate max-w-[150px]">
                              {letter.spotifyTrack.artist}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-black italic">
                          {new Date(letter.timestamp.toDate()).toLocaleDateString()}
                        </span>
                        <p className="text-right text-xs font-medium text-gray-950">
                          {letter.name}
                        </p>
                      </div>
                      
                      <div className="flex justify-center">
                        <button
                          onClick={(e) => handleLike(e, letter.id)}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full 
                            ${likedLetters.has(letter.id) 
                              ? 'bg-[#C688F8] text-white' 
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'} 
                            transition-colors duration-300`}
                        >
                          <svg 
                            className={`w-3 h-3 ${likedLetters.has(letter.id) ? 'text-white' : 'text-[#C688F8]'}`}
                            fill="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                          </svg>
                          {letter.likes > 0 && (
                            <span className="text-[10px] font-medium">
                              {letter.likes}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Masonry>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No letters found{selectedMember !== 'all' ? ` for ${selectedMember}` : ''}. 
            Be the first to write one!
          </div>
        )}
      </div>
    </main>
  );
}
