// Multiplayer Sync Adapter
// Integrates WebRTC with GameState for real-time synchronization
// Uses authority model: host is source of truth

const SyncAdapter = {
  isHost: false,
  isConnected: false,
  roomId: null,
  localPlayerId: null,
  pendingMoves: [], // Queue for moves when disconnected
  lastSyncTime: 0,
  syncInterval: null,

  // Initialize sync for a room
  async init(roomId, isHost, playerId) {
    this.roomId = roomId;
    this.isHost = isHost;
    this.localPlayerId = playerId;

    // Initialize WebRTC
    WebRTCAdapter.init(roomId, isHost);

    // Setup message handlers
    WebRTCAdapter.onMessage = (peerId, message) => {
      this.handleMessage(peerId, message);
    };

    WebRTCAdapter.onPeerJoin = (peerId) => {
      console.log(`Peer joined: ${peerId}`);
      if (this.isHost) {
        // Send current game state to new peer
        this.broadcastState();
      }
    };

    WebRTCAdapter.onPeerLeave = (peerId) => {
      console.log(`Peer left: ${peerId}`);
    };

    // Connect signaling
    await WebRTCAdapter.connectSignaling();

    // Start polling for signals (localStorage method)
    this.startPolling();

    this.isConnected = true;
    console.log(`Sync: Initialized as ${isHost ? "host" : "client"}`);

    return true;
  },

  // Start polling for signals
  startPolling() {
    this.syncInterval = setInterval(() => {
      WebRTCAdapter.pollSignals();
    }, 1000);
  },

  // Stop polling
  stopPolling() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  },

  // Handle incoming messages
  handleMessage(peerId, message) {
    switch (message.type) {
      case "game-state":
        // Client receiving state update from host
        if (!this.isHost) {
          this.onStateUpdate?.(message.state);
        }
        break;

      case "move":
        // Host receiving move from client
        if (this.isHost) {
          this.onRemoteMove?.(message.playerId, message.move);
        }
        break;

      case "sync-request":
        // Host responding to sync request
        if (this.isHost) {
          this.broadcastState();
        }
        break;

      case "challenge":
        // Challenge wild4
        this.onChallenge?.(message.challengerId, message.targetId);
        break;

      case "jump-in":
        // Jump-in move
        this.onJumpIn?.(message.playerId, message.cardId, message.chosenColor);
        break;

      default:
        console.warn("Unknown message type:", message.type);
    }
  },

  // Host broadcasts current game state to all clients
  broadcastState(gameState, matchState) {
    if (!this.isHost) return;

    const state = {
      type: "game-state",
      state: {
        gameState,
        matchState,
        timestamp: Date.now(),
      },
    };

    WebRTCAdapter.broadcast(state);
  },

  // Client sends a move to host
  submitMove(moveType, data) {
    if (this.isHost) {
      // Host processes locally
      return { success: true, local: true };
    }

    // Client sends to host
    const message = {
      type: "move",
      playerId: this.localPlayerId,
      move: { type: moveType, ...data },
    };

    const sent = WebRTCAdapter.broadcast(message);
    if (sent === 0) {
      // Queue for later if not connected
      this.pendingMoves.push(message);
      return { success: false, queued: true };
    }

    return { success: true };
  },

  // Send a game message to a specific peer
  sendTo(peerId, message) {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === "open") {
      channel.send(JSON.stringify(message));
      return true;
    }
    return false;
  },

  // Broadcast a message to all connected peers
  broadcast(message) {
    let sent = 0;
    for (const [peerId, channel] of this.dataChannels) {
      if (channel.readyState === "open") {
        channel.send(JSON.stringify(message));
        sent++;
      }
    }
    return sent;
  },

  // Send a chat message to all peers
  sendChat(senderId, senderName, text) {
    const message = {
      type: "chat",
      senderId,
      senderName,
      text,
      timestamp: Date.now(),
    };

    // Add to local history immediately
    this.onChatMessage?.(message);

    // Broadcast to peers
    return this.broadcast(message);
  },

  // Submit a challenge (wild4 challenge)
  submitChallenge(challengerId, targetId) {
    const message = {
      type: "challenge",
      challengerId,
      targetId,
    };

    if (this.isHost) {
      this.onChallenge?.(challengerId, targetId);
      return { success: true };
    }

    WebRTCAdapter.broadcast(message);
    return { success: true };
  },

  // Submit a jump-in
  submitJumpIn(playerId, cardId, chosenColor) {
    const message = {
      type: "jump-in",
      playerId,
      cardId,
      chosenColor,
    };

    if (this.isHost) {
      this.onJumpIn?.(playerId, cardId, chosenColor);
      return { success: true };
    }

    WebRTCAdapter.broadcast(message);
    return { success: true };
  },

  // Request state sync (client only)
  requestSync() {
    if (this.isHost) return;

    WebRTCAdapter.broadcast({ type: "sync-request" });
  },

  // Invite a peer to join (host only)
  async invitePeer(peerId) {
    if (!this.isHost) return false;
    return await WebRTCAdapter.invitePeer(peerId);
  },

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      isHost: this.isHost,
      peers: WebRTCAdapter.getConnectedPeers(),
      pendingMoves: this.pendingMoves.length,
    };
  },

  // Disconnect and cleanup
  disconnect() {
    this.stopPolling();
    WebRTCAdapter.disconnect();
    this.isConnected = false;
    this.pendingMoves = [];
    console.log("Sync: Disconnected");
  },

  // Callbacks (set by gameState)
  onStateUpdate: null, // (state) => void - client receiving state
  onRemoteMove: null, // (playerId, move) => void - host receiving move
  onChallenge: null, // (challengerId, targetId) => void
  onJumpIn: null, // (playerId, cardId, chosenColor) => void
};

// Export for use
Object.assign(window, { SyncAdapter });
