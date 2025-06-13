'use client'; // MUST BE THE FIRST LINE
import ChatBox from '@/app/components/ChatBox';
import Poll from '@/app/components/Poll';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Corrected relative imports

// --- Interfaces ---
enum VideoSourceType { YOUTUBE = 'youtube', LOCAL = 'local' }
interface RoomDetails { id: string; sourceType: VideoSourceType; youtubeVideoId: string | null; }
interface ChatMessage { author: string; message: string; }
interface PollOption { text: string; votes: number; voters: string[]; }
interface PollData { question: string; options: PollOption[]; }
interface FullRoomState {
  lastEvent: 'play' | 'pause';
  lastKnownTime: number;
  lastUpdateTime: number;
  chatHistory: ChatMessage[];
  activePoll: PollData | null;
}

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: () => void; }
}

export default function WatchPage() {
  const { roomId } = useParams() as { roomId: string };
  const router = useRouter();

  // ... (The rest of your component's code does not need to change) ...
  // ... (All the state, effects, and render logic can remain the same) ...

  const [userName, setUserName] = useState('');
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activePoll, setActivePoll] = useState<PollData | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  const playerRef = useRef<any>(null);
  const isEventFromSelf = useRef(false);

  useEffect(() => {
    const name = sessionStorage.getItem('userName');
    if (!name) { router.push('/'); return; }
    setUserName(name);

    if (!roomId) return; 

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/rooms/${roomId}`)
      .then(res => { if (!res.ok) throw new Error('Room not found.'); return res.json(); })
      .then(setRoomDetails)
      .catch(err => setError(err.message));
  }, [roomId, router]);

  useEffect(() => {
    if (!userName || !roomDetails || !roomId) return;
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL!);
    setSocket(newSocket);

    newSocket.on('connect', () => newSocket.emit('joinRoom', { roomId, name: userName }));
    newSocket.on('roomStateSynced', (state: FullRoomState) => {
      setChatHistory(state.chatHistory || []);
      setActivePoll(state.activePoll || null);
    });
    newSocket.on('newMessage', (msg) => setChatHistory((prev) => [...prev, msg]));
    newSocket.on('pollCreated', (poll) => setActivePoll(poll));
    newSocket.on('pollUpdated', (poll) => setActivePoll(poll));
    newSocket.on('userStartedTyping', (name) => setTypingUsers((prev) => [...new Set([...prev, name])]));
    newSocket.on('userStoppedTyping', (name) => setTypingUsers((prev) => prev.filter(u => u !== name)));
    newSocket.on('playbackSynced', (data) => {
      if (playerRef.current && !isEventFromSelf.current) {
        if (roomDetails.sourceType === VideoSourceType.YOUTUBE) {
          playerRef.current.seekTo(data.currentTime, true);
          if (data.event === 'play') playerRef.current.playVideo();
          else playerRef.current.pauseVideo();
        } else if (roomDetails.sourceType === VideoSourceType.LOCAL) {
          playerRef.current.currentTime = data.currentTime;
          if (data.event === 'play') playerRef.current.play();
          else playerRef.current.pause();
        }
      }
    });

    return () => { newSocket.disconnect(); };
  }, [userName, roomDetails, roomId]);

  useEffect(() => {
    if (roomDetails?.sourceType === VideoSourceType.YOUTUBE && roomDetails.youtubeVideoId) {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = () => {
        if (!playerRef.current) {
          playerRef.current = new window.YT.Player('player-youtube', {
            height: '480', width: '854', videoId: roomDetails.youtubeVideoId,
            playerVars: { 'playsinline': 1, 'origin': window.location.origin },
            events: { onStateChange: onYouTubePlayerStateChange },
          });
        }
      };
    }
  }, [roomDetails]);

  const handlePlayerEvent = (event: 'play' | 'pause', currentTime: number) => {
    isEventFromSelf.current = true;
    socket?.emit('syncPlayback', { roomId, event, currentTime });
    setTimeout(() => { isEventFromSelf.current = false; }, 100);
  };

  const onYouTubePlayerStateChange = (event: any) => {
    if (event.data === window.YT.PlayerState.PLAYING) handlePlayerEvent('play', event.target.getCurrentTime());
    else if (event.data === window.YT.PlayerState.PAUSED) handlePlayerEvent('pause', event.target.getCurrentTime());
  };

  const renderPlayer = () => {
    if (error) return <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>;
    if (!roomDetails) return <div style={{ width: '854px', height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}><p>Loading room details...</p></div>;
    
    if (roomDetails.sourceType === VideoSourceType.YOUTUBE) {
      return <div id="player-youtube" style={{ backgroundColor: 'black', width: '854px', height: '480px' }} />;
    }
    
    if (roomDetails.sourceType === VideoSourceType.LOCAL) {
      return (
        <video
          ref={playerRef}
          controls
          width="854"
          height="480"
          src={`${process.env.NEXT_PUBLIC_API_URL}/stream/${roomId}`}
          onPlay={(e) => handlePlayerEvent('play', e.currentTarget.currentTime)}
          onPause={(e) => handlePlayerEvent('pause', e.currentTarget.currentTime)}
          style={{ backgroundColor: 'black' }}
        />
      );
    }
    
    return <p>Invalid video source detected.</p>;
  };

  const CopyRoomId = () => {
    const [copied, setCopied] = useState(false);
    
    const copyToClipboard = () => {
      if (!roomId) return;
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); 
    };
    
    return (
      <div style={{ background: '#f0f0f0', padding: '1rem', borderRadius: '8px', textAlign: 'center', marginTop: '1rem', width: '100%', maxWidth: '854px' }}>
        <h3>Share this Room!</h3>
        <p>Send this code to your friends so they can join:</p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            readOnly
            value={roomId || "Loading..."}
            style={{ padding: '0.5rem', border: '1px solid #ccc', flexGrow: 1, textAlign: 'center', fontWeight: 'bold' }}
          />
          <button onClick={copyToClipboard} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <main style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', background: '#fff' }}>
      <div style={{ flex: 3, padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Welcome, {userName}!</h1>
        <div id="player-container">{renderPlayer()}</div>
        <CopyRoomId />
      </div>
      
      <div style={{ flex: 1, borderLeft: '2px solid #eee', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', background: '#fafafa' }}>
        {socket ? (
          <>
            <ChatBox
              socket={socket}
              roomId={roomId}
              initialHistory={chatHistory}
              typingUsers={typingUsers.filter(name => name !== userName)}
            />
            <Poll
              socket={socket}
              roomId={roomId}
              activePoll={activePoll}
              userName={userName}
            />
          </>
        ) : (
          <p>Connecting to services...</p>
        )}
      </div>
    </main>
  );
}