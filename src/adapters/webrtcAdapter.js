// WebRTC Multiplayer Adapter
// Handles peer-to-peer connections using WebRTC DataChannels
// Uses a simple signaling server via Supabase broadcast or similar

const WebRTCAdapter = {
  // Connection state
  isHost: false,
  roomId: null,
  localId: `player-${Math.random().toString(36).slice(2, 8)}`,
  connections: new Map(), // peerId -> RTCPeerConnection
  dataChannels: new Map(), // peerId -> RTCDataChannel
  onMessage: null, // Callback for incoming messages
  onPeerJoin: null, // Callback when peer joins
  onPeerLeave: null, // Callback when peer leaves
  signalingChannel: null, // Supabase realtime channel for signaling

  // ICE servers for NAT traversal
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],

  // Initialize adapter
  init(roomId, isHost = false) {
    this.roomId = roomId;
    this.isHost = isHost;
    console.log(
      `WebRTC: Initializing as ${isHost ? "host" : "client"} in room ${roomId}`,
    );
    return this;
  },

  // Connect to signaling server (using Supabase broadcast)
  async connectSignaling() {
    // For now, we'll use a simple polling mechanism
    // In production, this would use Supabase Realtime broadcast
    console.log("WebRTC: Signaling channel would connect here");
    return true;
  },

  // Create a peer connection to a remote peer
  createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, {
          type: "ice-candidate",
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Peer ${peerId} state:`, pc.connectionState);
      if (pc.connectionState === "connected") {
        this.onPeerJoin?.(peerId);
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        this.onPeerLeave?.(peerId);
        this.connections.delete(peerId);
        this.dataChannels.delete(peerId);
      }
    };

    this.connections.set(peerId, pc);
    return pc;
  },

  // Create a data channel on the host side
  createDataChannel(peerId) {
    const pc = this.connections.get(peerId);
    if (!pc) return null;

    const channel = pc.createDataChannel("game", {
      ordered: true, // Ensure messages arrive in order
    });

    this.setupDataChannel(channel, peerId);
    return channel;
  },

  // Setup data channel event handlers
  setupDataChannel(channel, peerId) {
    channel.onopen = () => {
      console.log(`Data channel open with ${peerId}`);
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.onMessage?.(peerId, message);
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    channel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
    };

    this.dataChannels.set(peerId, channel);
  },

  // Host: Invite a peer to join
  async invitePeer(peerId) {
    const pc = this.createPeerConnection(peerId);
    const channel = this.createDataChannel(peerId);

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send offer via signaling
    this.sendSignal(peerId, { type: "offer", sdp: offer });

    return true;
  },

  // Client: Accept an invitation
  async acceptInvite(peerId, offer) {
    const pc = this.createPeerConnection(peerId);

    // Handle incoming data channel (as the answerer, we wait for ondatachannel)
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, peerId);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignal(peerId, { type: "answer", sdp: answer });

    return true;
  },

  // Handle incoming signaling messages
  async handleSignal(peerId, signal) {
    const pc =
      this.connections.get(peerId) || this.createPeerConnection(peerId);

    switch (signal.type) {
      case "offer":
        await this.acceptInvite(peerId, signal.sdp);
        break;

      case "answer":
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        break;

      case "ice-candidate":
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        break;

      default:
        console.warn("Unknown signal type:", signal.type);
    }
  },

  // Send a signal via the signaling channel
  sendSignal(peerId, signal) {
    // Use Supabase signaling if available, fallback to localStorage
    if (window.SupabaseSignaling?.supabase) {
      SupabaseSignaling.sendSignal(signal, peerId);
    } else {
      // Fallback to localStorage for local testing
      const key = `webrtc-signal-${this.roomId}-${peerId}`;
      const signals = JSON.parse(localStorage.getItem(key) || "[]");
      signals.push({ from: this.localId, ...signal, timestamp: Date.now() });
      localStorage.setItem(key, JSON.stringify(signals));
    }
  },

  // Poll for incoming signals
  async pollSignals() {
    // Supabase uses realtime push, no polling needed
    if (window.SupabaseSignaling?.supabase) {
      return;
    }

    // localStorage fallback polling
    const key = `webrtc-signal-${this.roomId}-${this.localId}`;
    const signals = JSON.parse(localStorage.getItem(key) || "[]");

    // Clear processed signals
    localStorage.setItem(key, "[]");

    for (const signal of signals) {
      await this.handleSignal(signal.from, signal);
    }
  },

  // Setup Supabase signaling callbacks
  setupSupabaseSignaling() {
    if (!window.SupabaseSignaling) return;

    SupabaseSignaling.onSignal = async (from, signal) => {
      await this.handleSignal(from, signal);
    };

    SupabaseSignaling.onPlayerJoin = (playerId) => {
      // Auto-invite new players if we're the host
      if (this.isHost) {
        this.invitePeer(playerId);
      }
    };

    SupabaseSignaling.onPlayerLeave = (playerId) => {
      // Cleanup connection
      this.connections.get(playerId)?.close();
      this.connections.delete(playerId);
      this.dataChannels.delete(playerId);
    };
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

  // Get list of connected peers
  getConnectedPeers() {
    return Array.from(this.dataChannels.keys()).filter(
      (id) => this.dataChannels.get(id).readyState === "open",
    );
  },

  // Disconnect from all peers
  disconnect() {
    for (const [peerId, pc] of this.connections) {
      this.dataChannels.get(peerId)?.close();
      pc.close();
    }
    this.connections.clear();
    this.dataChannels.clear();
    console.log("WebRTC: Disconnected");
  },
};

// Export for use
Object.assign(window, { WebRTCAdapter });
