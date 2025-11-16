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

    const fetchMessages = async () => {
      try {
        setLoading(true);
        // First, get the host's listing IDs
        const listingsRef = collection(db, 'listings');
        const qListings = query(listingsRef, where('hostId', '==', user.uid));
        const listingsSnap = await getDocs(qListings);
        const listingIds = listingsSnap.docs.map((d) => d.id);

        if (listingIds.length === 0) {
          setMessages([]);
          setLoading(false);
          return undefined;
        }

        // Now query messages for these listings
        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, where('listingId', 'in', listingIds));

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
    };

    const unsubscribePromise = fetchMessages();
    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
    };
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <Typography variant="h4" gutterBottom>
        Host Messages
      </Typography>
      <Box sx={{ display: 'flex', flex: 1, gap: 2 }}>
        <Paper sx={{ width: 320, p: 2, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle1" gutterBottom>
            Conversations
          </Typography>
          {loading ? (
            <Typography variant="body2">Loading messages...</Typography>
          ) : conversations.length === 0 ? (
            <Typography variant="body2">You have no messages yet.</Typography>
          ) : (
            <List sx={{ flex: 1, overflowY: 'auto' }}>
              {conversations.map((conv) => (
                <ListItem key={conv.key} disablePadding>
                  <ListItemButton
                    selected={conv.key === selectedKey}
                    onClick={() => setSelectedKey(conv.key)}
                  >
                    <ListItemText
                      primary={conv.listingTitle}
                      secondary={conv.guestEmail ? `Guest: ${conv.guestEmail}` : `Guest: ${conv.guestId}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        <Paper sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
          {!selectedConversation ? (
            <Typography variant="body2" color="text.secondary">
              Select a conversation to view messages.
            </Typography>
          ) : (
            <>
              <Typography variant="subtitle1" gutterBottom>
                Listing: {selectedConversation.listingTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Guest: {selectedConversation.guestId}
              </Typography>
              <Box sx={{ flex: 1, overflowY: 'auto', mb: 2, bgcolor: '#f9fafb', p: 1 }}>
                {threadMessages.map((msg) => {
                  const isHost = msg.senderRole === 'host' || msg.hostId === user?.uid;
                  const createdAt = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
                  return (
                    <Box
                      key={msg.id}
                      sx={{
                        display: 'flex',
                        justifyContent: isHost ? 'flex-end' : 'flex-start',
                        mb: 1,
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '70%',
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: isHost ? 'primary.main' : 'background.paper',
                          color: isHost ? 'primary.contrastText' : 'text.primary',
                          border: isHost ? 'none' : '1px solid #e5e7eb',
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
                            sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}
                          >
                            {createdAt.toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
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
        </Paper>
      </Box>
    </Box>
  );
}
