'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Letter } from '../../types/Letter';
import SpotifyPlayer from '../../components/SpotifyPlayer';

export default function LetterPage() {
  const params = useParams();
  const router = useRouter();
  const [letter, setLetter] = useState<Letter | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    async function fetchLetter() {
      try {
        const letterId = params.id as string;
        const letterDoc = await getDoc(doc(db, 'letters', letterId));
        
        if (letterDoc.exists()) {
          setLetter({
            id: letterDoc.id,
            ...letterDoc.data()
          } as Letter);
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Error fetching letter:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    fetchLetter();
  }, [params.id, router]);

  useEffect(() => {
    if (letter) {
      const likedLetters = new Set(JSON.parse(localStorage.getItem('likedLetters') || '[]'));
      setIsLiked(likedLetters.has(letter.id));
    }
  }, [letter]);

  const handleShare = async (platform: string) => {
    if (!letter) return;
    
    const letterUrl = `${window.location.origin}/letter/${letter.id}`;
    const text = `Read this heartfelt letter to ${letter.member} from a fellow ARMY! 💜`;
    
    let shareUrl = '';
    
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${letterUrl}`)}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(letterUrl)}&text=${encodeURIComponent(text)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(letterUrl)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text}\n\n${letterUrl}`)}`;
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(letterUrl);
          alert('Link copied! Share it with your fellow ARMYs! 💜');
          return;
        } catch (err) {
          console.error('Failed to copy:', err);
          alert('Failed to copy link');
        }
        return;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleLike = async () => {
    if (!letter) return;
    const currentUserId = localStorage.getItem('userId') || crypto.randomUUID();
    
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', currentUserId);
    }

    try {
      const letterRef = doc(db, 'letters', letter.id);
      
      await updateDoc(letterRef, {
        likes: increment(isLiked ? -1 : 1),
        likedBy: isLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId)
      });

      setLetter(prev => prev ? {
        ...prev,
        likes: (prev.likes || 0) + (isLiked ? -1 : 1)
      } : null);
      setIsLiked(!isLiked);

      const likedLetters = new Set(JSON.parse(localStorage.getItem('likedLetters') || '[]'));
      if (isLiked) {
        likedLetters.delete(letter.id);
      } else {
        likedLetters.add(letter.id);
      }
      localStorage.setItem('likedLetters', JSON.stringify([...likedLetters]));

    } catch (error) {
      console.error('Error updating likes:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4C0083] border-t-transparent"></div>
      </div>
    );
  }

  if (!letter) {
    return null;
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col bg-white">
      <div className="text-center max-w-4xl mx-auto mb-8">
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

      <div className="w-full max-w-2xl mx-auto">
        <div className={`p-6 rounded-2xl shadow-xl ${letter.colorClass}`}>
          <div className="text-center mb-4">
            <h3 className="text-2xl font-bold text-purple-600">
              To: {letter.member}
            </h3>
          </div>

          <div className="text-white mb-6">
            <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">
              {letter.message}
            </p>
          </div>

          <div className="flex flex-col pt-4 border-t border-black/20">
            <div className="flex justify-between items-center mb-4">
              <span className="font-style: italic text-sm text-black/50">
                {new Date(letter.timestamp.toDate()).toLocaleDateString()}
              </span>
              <p className="text-base font-semibold text-black">
                By: {letter.name}
              </p>
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 px-4 py-2 rounded-full 
                  ${isLiked 
                    ? 'bg-[#C688F8] text-white' 
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'} 
                  transition-all duration-300 transform hover:scale-105`}
              >
                <svg 
                  className={`w-6 h-6 ${isLiked ? 'text-white' : 'text-[#C688F8]'}`}
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span className={`text-lg font-medium ${isLiked ? 'text-white' : 'text-[#C688F8]'}`}>
                  {letter.likes ?? 0}
                </span>
              </button>
            </div>
          </div>

          {letter.spotifyTrack && (
            <div className="mt-8 pt-4 border-t border-white/20">
              <p className="text-center text-sm text-white/80 mb-4">Favorite song</p>
              <div className="flex items-center justify-center gap-4">
                <img 
                  src={letter.spotifyTrack.albumCover}
                  alt={letter.spotifyTrack.name}
                  className="w-16 h-16 rounded-md"
                />
                <div>
                  <p className="font-medium text-white text-lg">{letter.spotifyTrack.name}</p>
                  <p className="text-sm text-white/80">{letter.spotifyTrack.artist}</p>
                </div>
              </div>
              <p className="text-center text-sm text-white/80 mt-6 mb-3">Listen</p>
              <SpotifyPlayer songId={letter.spotifyTrack.id} />
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-black/20">
            <p className="text-center italic text-sm text-black/70 mb-4">
              Share this letter with ARMYs 💜
            </p>
            <div className="share-buttons-container">
              <button
                onClick={() => handleShare('whatsapp')}
                className="share-button-small bg-[#25D366]/90 hover:bg-[#25D366]"
                aria-label="Share on WhatsApp"
              >
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                </svg>
              </button>

              <button
                onClick={() => handleShare('telegram')}
                className="share-button-small bg-[#0088cc]/90 hover:bg-[#0088cc]"
                aria-label="Share on Telegram"
              >
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </button>

              <button
                onClick={() => handleShare('facebook')}
                className="share-button-small bg-[#1877F2]/90 hover:bg-[#1877F2]"
                aria-label="Share on Facebook"
              >
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>

              <button
                onClick={() => handleShare('twitter')}
                className="share-button-small bg-black/80 hover:bg-black"
                aria-label="Share on Twitter"
              >
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </button>

              <button
                onClick={() => handleShare('copy')}
                className="share-button-small bg-[#9333EA]/80 hover:bg-[#9333EA]"
                aria-label="Copy Link"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/')}
              className="bg-[#C688F8] hover:bg-[#B674E7] text-white px-8 py-3 rounded-full 
                font-medium transition-all duration-300 transform hover:scale-105 
                shadow-lg hover:shadow-xl flex items-center justify-center mx-auto gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Create Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 