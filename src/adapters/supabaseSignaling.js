// Supabase Signaling Adapter
// Uses Supabase Realtime for WebRTC signaling (SDP offers/answers and ICE candidates)
// Replaces the localStorage polling method for production multiplayer

const SupabaseSignaling = {
  supabase: null,
  roomId: null,
  playerId: null,
  isHost: false,
  subscription: null,
  
  // Callbacks
  onSignal: null, // (fromPlayerId, signal) => void
  onPlayerJoin: null, // (playerId) => void
  onPlayerLeave: null, // (playerId) => void

  // Initialize Supabase client
  init(supabaseClient, roomId, playerId, isHost = false) {
    this.supabase = supabaseClient;
    this.roomId = roomId;
    this.playerId = playerId;
    this.isHost = isHost;
    
    console.log(`Supabase Signaling: ${playerId} in room ${roomId} (${isHost ? 'host' : 'client'})`);
    return this;
  },

  // Subscribe to room signaling channel
  async subscribe() {
    if (!this.supabase || !this.roomId) {
      throw new Error('Supabase client and roomId required');
    }

    // Subscribe to room channel for signaling messages
    this.subscription = this.supabase
      .channel(`room:${this.roomId}`)
      .on('broadcast', { event: 'signal' }, (payload) => {
        const { from, to, signal } = payload.payload;
        
        // Only process messages intended for us (or broadcast to all)
        if (to && to !== this.playerId) return;
        if (from === this.playerId) return; // Ignore our own messages
        
        console.log(`Signal from ${from}:`, signal.type);
        this.onSignal?.(from, signal);
      })
      .on('broadcast', { event: 'presence' }, (payload) => {
        const { type, playerId } = payload.payload;
        if (playerId === this.playerId) return;
        
        if (type === 'join') {
          console.log(`Player joined: ${playerId}`);
          this.onPlayerJoin?.(playerId);
        } else if (type === 'leave') {
          console.log(`Player left: ${playerId}`);
          this.onPlayerLeave?.(playerId);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to signaling channel');
          // Announce presence
          this.broadcast('presence', { type: 'join', playerId: this.playerId });
        }
      });

    return true;
  },

  // Send a signal to a specific peer (or broadcast if no target)
  async sendSignal(signal, targetPlayerId = null) {
    if (!this.supabase || !this.roomId) {
      throw new Error('Not initialized');
    }

    const payload = {
      from: this.playerId,
      to: targetPlayerId,
      signal,
      timestamp: Date.now(),
    };

    const { error } = await this.supabase
      .channel(`room:${this.roomId}`)
      .send({
        type: 'broadcast',
        event: 'signal',
        payload,
      });

    if (error) {
      console.error('Failed to send signal:', error);
      return false;
    }

    return true;
  },

  // Broadcast a message to all peers
  async broadcast(event, payload) {
    if (!this.supabase || !this.roomId) return false;

    const { error } = await this.supabase
      .channel(`room:${this.roomId}`)
      .send({
        type: 'broadcast',
        event,
        payload: { ...payload, from: this.playerId },
      });

    return !error;
  },

  // Send SDP offer to a peer
  async sendOffer(targetPlayerId, sdp) {
    return this.sendSignal({ type: 'offer', sdp }, targetPlayerId);
  },

  // Send SDP answer to a peer
  async sendAnswer(targetPlayerId, sdp) {
    return this.sendSignal({ type: 'answer', sdp }, targetPlayerId);
  },

  // Send ICE candidate to a peer
  async sendIceCandidate(targetPlayerId, candidate) {
    return this.sendSignal({ type: 'ice-candidate', candidate }, targetPlayerId);
  },

  // Unsubscribe from channel
  unsubscribe() {
    if (this.subscription) {
      // Announce departure
      this.broadcast('presence', { type: 'leave', playerId: this.playerId });
      
      this.supabase.removeChannel(this.subscription);
      this.subscription = null;
    }
  },

  // Store room state in Supabase (for persistence)
  async saveRoomState(roomId, state) {
    if (!this.supabase) return false;

    const { error } = await this.supabase
      .from('game_rooms')
      .upsert({
        room_id: roomId,
        state: state,
        updated_at: new Date().toISOString(),
        host_id: this.playerId,
      }, { onConflict: 'room_id' });

    return !error;
  },

  // Load room state from Supabase
  async loadRoomState(roomId) {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('game_rooms')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (error) return null;
    return data?.state || null;
  },
};

// Export for use
Object.assign(window, { SupabaseSignaling });
