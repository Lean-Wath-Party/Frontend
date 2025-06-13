'use client';
import ChatBox from '@/app/components/ChatBox';
import Poll from '@/app/components/Poll';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Import the new components

// --- TypeScript Interfaces for Data Structures ---
enum VideoSourceType {
  YOUTUBE = 'youtube',
  LOCAL = 'local',
}

interface RoomDetails { // Static data about the room
  id: string;
  sourceType: VideoSourceType;
  youtubeVideoId: string | null;
}

interface ChatMessage {
  author: string;
  message: string;
}

interface PollOption {
  text: string;
  votes: number;
}

interface PollData {
  question: string;
  options: PollOption[];
}

interface FullRoomState { // The initial sync object from the server
  lastEvent: 'play' | 'pause';
  lastKnownTime: number;
  lastUpdateTime: number;
  chatHistory: ChatMessage[];
  activePoll: PollData | null;
}

// Helper for the YouTube Iframe Player API
declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: () => void; }
}

export default function WatchPage() {
  const  roomId  = useParams().roomId as string;
  const router = useRouter();

  // --- State Management ---
  const [userName, setUserName] = useState('');
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activePoll, setActivePoll] = useState<PollData | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [error, setError] = useState('');

  // --- Refs for direct access to elements/objects ---
  const socketRef = useRef<Socket | null>(null);
  const playerRef = useRef<any>(null); // Can hold a YT Player or an HTMLVideoElement
  const isEventFromSelf = useRef(false);

  // --- Effect 1: Initial setup (get user name, fetch static room data) ---
  useEffect(() => {
    const name = sessionStorage.getItem('userName');
    if (!name) {
      router.push('/');
      return;
    }
    setUserName(name);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/rooms/${roomId}`)
      .then(res => {
        if (!res.ok) throw new Error('Room not found. Please check the code and try again.');
        return res.json();
      })
      .then(data => setRoomDetails(data))
      .catch(err => setError(err.message));
  }, [roomId, router]);

  // --- Effect 2: WebSocket connection and event listeners ---
  useEffect(() => {
    // Wait until we have the necessary data before connecting
    if (!userName || !roomDetails) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL!);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to WebSocket server!');
      socket.emit('joinRoom', { roomId, name: userName });
    });

    // This event syncs the entire dynamic state when a user first joins
    socket.on('roomStateSynced', (state: FullRoomState) => {
      console.log('Received initial room state:', state);
      setChatHistory(state.chatHistory || []);
      setActivePoll(state.activePoll || null);
      // You could also sync player time here if needed
    });

    // Listen for incremental, real-time updates
    socket.on('newMessage', (message: ChatMessage) => setChatHistory((prev) => [...prev, message]));
    socket.on('pollCreated', (poll: PollData) => setActivePoll(poll));
    socket.on('pollUpdated', (poll: PollData) => setActivePoll(poll));
    socket.on('userStartedTyping', (name: string) => setTypingUsers((prev) => [...new Set([...prev, name])]));
    socket.on('userStoppedTyping', (name: string) => setTypingUsers((prev) => prev.filter(u => u !== name)));

    socket.on('playbackSynced', (data: { event: 'play' | 'pause', currentTime: number }) => {
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

    // Cleanup: Disconnect the socket when the component unmounts
    return () => { socket.disconnect(); };
  }, [userName, roomDetails, roomId]);

  // --- Effect 3: Initialize YouTube player when its details are available ---
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

  // --- Player Event Handlers ---
  const handlePlayerEvent = (event: 'play' | 'pause', currentTime: number) => {
    isEventFromSelf.current = true;
    socketRef.current?.emit('syncPlayback', { roomId, event, currentTime });
    setTimeout(() => { isEventFromSelf.current = false; }, 100);
  };

  const onYouTubePlayerStateChange = (event: any) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      handlePlayerEvent('play', event.target.getCurrentTime());
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      handlePlayerEvent('pause', event.target.getCurrentTime());
    }
  };

  // --- UI Component Renderers ---
  const renderPlayer = () => {
    if (error) return <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>;
    if (!roomDetails) return <p>Loading room details...</p>;

    if (roomDetails.sourceType === VideoSourceType.YOUTUBE) {
      return <div id="player-youtube" style={{ backgroundColor: 'black', width: '854px', height: '480px' }} />;
    }
    if (roomDetails.sourceType === VideoSourceType.LOCAL) {
      return (
        <video
          ref={playerRef} controls width="854" height="480"
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
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    return (
      <div style={{ background: '#f0f0f0', padding: '1rem', borderRadius: '8px', textAlign: 'center', marginTop: '1rem', width: '100%', maxWidth: '854px' }}>
        <h3>Share this Room!</h3>
        <p>Send this code to your friends so they can join:</p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="text" readOnly value={roomId} style={{ padding: '0.5rem', border: '1px solid #ccc', flexGrow: 1, textAlign: 'center', fontWeight: 'bold' }} />
          <button onClick={copyToClipboard} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <main style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', background: '#fff' }}>
      {/* Left side: Video Player and Room Info */}
      <div style={{ flex: 3, padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Welcome, {userName}!</h1>
        <div id="player-container">{renderPlayer()}</div>
        <CopyRoomId />
      </div>
      
      {/* Right side: Sidebar for Chat and Polls */}
      <div style={{ flex: 1, borderLeft: '2px solid #eee', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', background: '#fafafa' }}>
        <ChatBox
          socket={socketRef.current}
          roomId={roomId}
          initialHistory={chatHistory}
          typingUsers={typingUsers.filter(name => name !== userName)} // Don't show "You are typing"
        />
        <Poll
          socket={socketRef.current}
          roomId={roomId}
          activePoll={activePoll}
        />
      </div>
    </main>
  );
}