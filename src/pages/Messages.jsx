import { useEffect, useState, useMemo } from 'react';
import { Box, Button, List, ListItem, ListItemButton, ListItemText, Paper, TextField, Typography } from '@mui/material';
import { collection, addDoc, onSnapshot, orderBy, query, where, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function HostMessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setLoading(false);
      return undefined;
    }

    try {
      setLoading(true);
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, where('hostId', '==', user.uid));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setMessages(items);
          setLoading(false);
        },
        (err) => {
          // eslint-disable-next-line no-console
          console.error('Error loading host messages', err);
          setMessages([]);
          setLoading(false);
        },
      );

      return () => unsubscribe();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error subscribing to host messages', err);
      setMessages([]);
      setLoading(false);
      return undefined;
    }
  }, [user]);

  const conversations = useMemo(() => {
    const map = new Map();
    messages.forEach((msg) => {
      const key = `${msg.listingId || 'unknown'}::${msg.guestId || 'unknown'}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          listingId: msg.listingId || 'unknown',
          guestId: msg.guestId || 'unknown',
          guestEmail: msg.guestEmail || null,
          listingTitle: msg.listingTitle || msg.listingId || 'Guest message',
        });
      }
    });
    return Array.from(map.values());
  }, [messages]);

  const selectedConversation = useMemo(() => {
    if (!selectedKey) return null;
    return conversations.find((c) => c.key === selectedKey) || null;
  }, [conversations, selectedKey]);

  const threadMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return messages
      .filter(
        (m) => m.listingId === selectedConversation.listingId && m.guestId === selectedConversation.guestId,
      )
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return aTime - bTime;
      });
  }, [messages, selectedConversation]);

  const handleSendReply = async () => {
    if (!user || !selectedConversation) return;
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        listingId: selectedConversation.listingId,
        guestId: selectedConversation.guestId,
        hostId: user.uid,
        senderId: user.uid,
        senderRole: 'host',
        text: replyText.trim(),
        createdAt: serverTimestamp(),
      });
      setReplyText('');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error sending reply', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        px: 3,
        py: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 1100 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Messages
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Chat with guests about your bookings.
        </Typography>

        <Paper
          sx={{
            display: 'flex',
            minHeight: 320,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: 280,
              borderRight: '1px solid #e5e7eb',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#f9fafb',
            }}
          >
            <Typography variant="subtitle1" gutterBottom>
              Conversations
            </Typography>
            {loading ? (
              <Typography variant="body2">Loading messages...</Typography>
            ) : conversations.length === 0 ? (
              <Typography variant="body2">You have no messages yet.</Typography>
            ) : (
              <List sx={{ flex: 1, overflowY: 'auto', mt: 1 }}>
                {conversations.map((conv) => (
                  <ListItem key={conv.key} disablePadding>
                    <ListItemButton
                      selected={conv.key === selectedKey}
                      onClick={() => setSelectedKey(conv.key)}
                    >
                      <ListItemText
                        primary={conv.listingTitle}
                        secondary={
                          conv.guestEmail
                            ? `Guest: ${conv.guestEmail}`
                            : `Guest: ${conv.guestId}`
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          <Box
            sx={{
              flex: 1,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper',
            }}
          >
            {!selectedConversation ? (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Select a conversation to view messages.
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle1">
                    {selectedConversation.listingTitle}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Guest: {selectedConversation.guestId}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    mb: 2,
                    bgcolor: '#f9fafb',
                    p: 2,
                    borderRadius: 2,
                  }}
                >
                  {threadMessages.map((msg) => {
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
                          <Box
                            sx={{
                              px: 2,
                              py: 1,
                              borderRadius: isSender ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                              bgcolor: isSender ? 'primary.main' : 'background.paper',
                              color: isSender ? 'primary.contrastText' : 'text.primary',
                              border: isSender ? 'none' : '1px solid #e5e7eb',
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
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    multiline
                    minRows={2}
                    fullWidth
                    size="small"
                    placeholder="Type a reply to the guest"
                  />
                  <Button
                    variant="contained"
                    onClick={handleSendReply}
                    disabled={sending || !replyText.trim()}
                  >
                    Send
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
