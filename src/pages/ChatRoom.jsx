import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Paper, TextField, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function ChatRoomPage() {
  const { listingId, guestId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!user || !listingId || !guestId) {
      setError('Invalid chat room parameters.');
      setLoading(false);
      return;
    }

    // Check if user is authorized (host or guest)
    const checkAccess = async () => {
      try {
        const listingRef = doc(db, 'listings', listingId);
        const listingSnap = await getDoc(listingRef);
        if (listingSnap.exists()) {
          const listingData = listingSnap.data();
          setListing(listingData);
          if (listingData.hostId !== user.uid && guestId !== user.uid) {
            setError('You are not authorized to access this chat room.');
            setLoading(false);
            return;
          }
        } else {
          setError('Listing not found.');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error checking access:', err);
        setError('Failed to verify access.');
        setLoading(false);
        return;
      }

      // Load messages
      try {
        setLoading(true);
        const messagesRef = collection(db, 'messages');
        const q = query(
          messagesRef,
          where('listingId', '==', listingId),
          where('guestId', '==', guestId),
          orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setMessages(items);
            setLoading(false);
          },
          (err) => {
            console.error('Error loading messages:', err);
            setError('Failed to load messages.');
            setMessages([]);
            setLoading(false);
          }
        );

        return () => unsubscribe();
      } catch (err) {
        console.error('Error subscribing to messages:', err);
        setError('Failed to load messages.');
        setMessages([]);
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, listingId, guestId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !listing) return;
    setSending(true);
    try {
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        listingId,
        guestId,
        hostId: listing.hostId,
        senderId: user.uid,
        senderRole: listing.hostId === user.uid ? 'host' : 'guest',
        listingTitle: listing.title || null,
        guestEmail: listing.hostId === user.uid ? null : user.email || null,
        text: messageText.trim(),
        createdAt: serverTimestamp(),
      });
      setMessageText('');
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Loading chat room...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', p: 2 }}>
        <Typography variant="h6" color="error" gutterBottom>
          {error}
        </Typography>
        <Button variant="contained" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Box>
    );
  }

  const isHost = listing?.hostId === user?.uid;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Chat: {listing?.title || 'Listing'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isHost ? 'Host' : 'Guest'}
        </Typography>
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {messages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography color="text.secondary">No messages yet. Start the conversation!</Typography>
          </Box>
        ) : (
          messages.map((msg) => {
            const isSender = msg.senderId === user?.uid;
            const createdAt = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
            return (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  justifyContent: isSender ? 'flex-end' : 'flex-start',
                  mb: 2,
                }}
              >
                <Box sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
                  <Typography
                    variant="caption"
                    sx={{ mb: 0.5, color: 'text.secondary', textAlign: isSender ? 'right' : 'left' }}
                  >
                    {isSender ? 'You' : (msg.senderRole === 'host' ? 'Host' : 'Guest')}
                  </Typography>
                  <Paper
                    sx={{
                      px: 2,
                      py: 1,
                      bgcolor: isSender ? 'primary.main' : 'background.paper',
                      color: isSender ? 'primary.contrastText' : 'text.primary',
                      borderRadius: isSender ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      boxShadow: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {msg.text}
                    </Typography>
                    {createdAt && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.5, opacity: 0.7, textAlign: 'right' }}
                      >
                        {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    )}
                  </Paper>
                </Box>
              </Box>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Box sx={{ p: 2, bgcolor: 'white', borderTop: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            multiline
            maxRows={4}
            fullWidth
            size="small"
            disabled={sending}
          />
          <IconButton
            onClick={handleSendMessage}
            disabled={sending || !messageText.trim()}
            color="primary"
            sx={{ alignSelf: 'flex-end' }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}
