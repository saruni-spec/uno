// Replay Adapter
// Records and plays back game sessions for review

const ReplayRecorder = {
  // Storage key prefix
  key(roomId) {
    return `replay:${roomId}`;
  },

  // Initialize new replay
  init(roomId, initialGameState) {
    try {
      const replay = {
        roomId,
        startedAt: new Date().toISOString(),
        frames: [{
          timestamp: Date.now(),
          type: 'init',
          gameState: JSON.parse(JSON.stringify(initialGameState)),
        }],
        players: initialGameState.players.map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          isBot: p.isBot,
        })),
      };
      localStorage.setItem(this.key(roomId), JSON.stringify(replay));
      return replay;
    } catch (e) {
      console.error('Failed to initialize replay:', e);
      return null;
    }
  },

  // Record a move
  recordMove(roomId, move) {
    try {
      const key = this.key(roomId);
      const saved = localStorage.getItem(key);
      if (!saved) return;

      const replay = JSON.parse(saved);
      replay.frames.push({
        timestamp: move.timestamp || Date.now(),
        type: move.type,
        playerId: move.playerId,
        cardId: move.cardId,
        chosenColor: move.chosenColor,
        gameState: move.gameState ? JSON.parse(JSON.stringify(move.gameState)) : null,
      });

      // Keep only last 500 frames to prevent storage issues
      if (replay.frames.length > 500) {
        replay.frames = replay.frames.slice(-500);
      }

      localStorage.setItem(key, JSON.stringify(replay));
    } catch (e) {
      console.error('Failed to record move:', e);
    }
  },

  // Finalize replay when game ends
  finalize(roomId, winnerId, matchState) {
    try {
      const key = this.key(roomId);
      const saved = localStorage.getItem(key);
      if (!saved) return;

      const replay = JSON.parse(saved);
      replay.endedAt = new Date().toISOString();
      replay.winnerId = winnerId;
      replay.matchState = {
        cumulativeScores: matchState?.cumulativeScores,
        currentRound: matchState?.currentRound,
      };
      replay.duration = replay.frames.length > 0 
        ? replay.frames[replay.frames.length - 1].timestamp - replay.frames[0].timestamp 
        : 0;

      localStorage.setItem(key, JSON.stringify(replay));
      
      // Also add to completed replays list
      this.addToCompletedList(replay);
      
      return replay;
    } catch (e) {
      console.error('Failed to finalize replay:', e);
      return null;
    }
  },

  // Add to completed replays index
  addToCompletedList(replay) {
    try {
      const key = 'shout:completedReplays';
      const saved = localStorage.getItem(key);
      const list = saved ? JSON.parse(saved) : [];
      
      list.unshift({
        roomId: replay.roomId,
        startedAt: replay.startedAt,
        endedAt: replay.endedAt,
        winnerId: replay.winnerId,
        playerCount: replay.players?.length || 0,
        duration: replay.duration,
        moveCount: replay.frames?.length || 0,
      });
      
      // Keep only last 20 replays
      if (list.length > 20) {
        list.length = 20;
      }
      
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to add to completed list:', e);
    }
  },

  // Get all completed replays
  getCompletedReplays() {
    try {
      const key = 'shout:completedReplays';
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  },

  // Load a specific replay
  load(roomId) {
    try {
      const saved = localStorage.getItem(this.key(roomId));
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  },

  // Delete a replay
  delete(roomId) {
    try {
      localStorage.removeItem(this.key(roomId));
      
      // Also remove from completed list
      const key = 'shout:completedReplays';
      const saved = localStorage.getItem(key);
      if (saved) {
        const list = JSON.parse(saved);
        const filtered = list.filter(r => r.roomId !== roomId);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  // Clear all replays
  clearAll() {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('replay:'))
        .forEach(key => localStorage.removeItem(key));
      localStorage.removeItem('shout:completedReplays');
      return true;
    } catch (e) {
      return false;
    }
  },

  // Export replay as shareable JSON
  exportForSharing(roomId) {
    const replay = this.load(roomId);
    if (!replay) return null;
    
    // Compress by removing redundant gameState data
    const compressed = {
      ...replay,
      frames: replay.frames.map(f => ({
        timestamp: f.timestamp,
        type: f.type,
        playerId: f.playerId,
        cardId: f.cardId,
        chosenColor: f.chosenColor,
        // Don't include full gameState in export
      })),
    };
    
    return JSON.stringify(compressed);
  },
};

// Export for use
Object.assign(window, { ReplayRecorder });
