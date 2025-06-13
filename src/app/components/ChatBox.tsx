'use client';
import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface ChatMessage { author: string; message: string; }
interface ChatBoxProps {
  socket: Socket | null;
  roomId: string;
  initialHistory: ChatMessage[];
  typingUsers: string[];
}

export default function ChatBox({ socket, roomId, initialHistory, typingUsers }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialHistory);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages(initialHistory); }, [initialHistory]);

  // Effect to close emoji picker when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the emoji picker container
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        // Also check if the click was not on the emoji toggle button itself
        const emojiButton = document.getElementById('emoji-toggle-button');
        if (emojiButton && !emojiButton.contains(event.target as Node)) {
          setShowEmojiPicker(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [emojiPickerRef]);
  
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    };
    socket.on('newMessage', handleNewMessage);
    return () => { socket.off('newMessage', handleNewMessage); };
  }, [socket]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleTyping = () => {
    if (socket) {
      socket.emit('startTyping', roomId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', roomId);
      }, 1500);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && socket) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit('stopTyping', roomId);
      socket.emit('sendMessage', { roomId, message: newMessage });
      setNewMessage('');
      setShowEmojiPicker(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('File upload failed.');

      const { imageUrl } = await response.json();
      const fileLink = `${process.env.NEXT_PUBLIC_API_URL}${imageUrl}`;
      socket.emit('sendMessage', { roomId, message: fileLink });
    } catch (error) {
      console.error('Upload Error:', error);
      alert('Upload failed. Please try again.');
    }
  };
  
  const renderMessage = (messageString: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const isApiUrl = messageString.includes(process.env.NEXT_PUBLIC_API_URL!);
    
    if (isApiUrl && (messageString.match(/\.(jpeg|jpg|gif|png)$/i) != null)) {
      return `<img src="${messageString}" alt="Shared content" style="max-width: 100%; border-radius: 4px;" />`;
    }
    if (isApiUrl) {
      const fileName = decodeURIComponent(messageString.split('-').pop() || '');
      return `<a href="${messageString}" target="_blank" rel="noopener noreferrer" style="color: #0056b3;">View File: ${fileName}</a>`;
    }
    return messageString.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  };

  return (
    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden', minHeight: '300px', position: 'relative' }}>
      <h3 style={{ margin: 0, padding: '0.8rem', background: '#f4f4f4', borderBottom: '1px solid #ccc', textAlign: 'center' }}>Live Chat</h3>
      <div style={{ flexGrow: 1, padding: '0.5rem', overflowY: 'auto' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: '0.5rem', wordBreak: 'break-word' }}>
            <strong style={{ color: '#007bff' }}>{msg.author}:</strong>{' '}
            <span dangerouslySetInnerHTML={{ __html: renderMessage(msg.message) }} />
          </div>
        ))}
        <div style={{ height: '20px', color: '#888', fontStyle: 'italic' }}>
          {typingUsers.length > 0 &&
            `${typingUsers.join(', ')} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`
          }
        </div>
        <div ref={chatBottomRef} />
      </div>
      {showEmojiPicker && (
        <div ref={emojiPickerRef} style={{ position: 'absolute', bottom: '50px', right: '10px', zIndex: 10 }}>
          <EmojiPicker onEmojiClick={handleEmojiClick} />
        </div>
      )}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', padding: '0.5rem', borderTop: '1px solid #ccc', background: '#f4f4f4', alignItems: 'center' }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
          placeholder="Type a message..."
          style={{ flexGrow: 1, border: '1px solid #ccc', padding: '0.4rem', borderRadius: '4px' }}
        />
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*,application/pdf" />
        <button id="emoji-toggle-button" type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ marginLeft: '0.5rem' }}>😀</button>
        <button type="button" onClick={() => fileInputRef.current?.click()} style={{ marginLeft: '0.5rem' }}>📎</button>
        <button type="submit" style={{ marginLeft: '0.5rem' }}>Send</button>
      </form>
    </div>
  );
}