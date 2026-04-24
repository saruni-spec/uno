// Tournament Adapter
// Manages bracket-style elimination tournaments

const TournamentAdapter = {
  // Storage key
  key(tournamentId) {
    return `tournament:${tournamentId}`;
  },

  // Create a new tournament
  create(config) {
    const tournament = {
      id: `tourney-${Date.now()}`,
      name: config.name || 'UNO Tournament',
      createdAt: new Date().toISOString(),
      status: 'setup', // setup, active, finished
      players: config.players || [],
      maxPlayers: config.maxPlayers || 16,
      minPlayers: config.minPlayers || 8,
      format: config.format || 'single', // single, double, round-robin
      bestOf: config.bestOf || 1, // 1, 3, 5
      currentRound: 0,
      rounds: [],
      winners: [],
      bracket: null,
    };
    
    this.save(tournament);
    return tournament;
  },

  // Save tournament state
  save(tournament) {
    try {
      localStorage.setItem(this.key(tournament.id), JSON.stringify(tournament));
      return true;
    } catch (e) {
      console.error('Failed to save tournament:', e);
      return false;
    }
  },

  // Load tournament
  load(tournamentId) {
    try {
      const saved = localStorage.getItem(this.key(tournamentId));
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  },

  // Generate bracket from player list
  generateBracket(players, format = 'single') {
    // Shuffle players for random seeding
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    
    // Calculate bracket size (next power of 2)
    const playerCount = shuffled.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(playerCount)));
    
    // Fill with byes if needed
    const padded = [...shuffled];
    while (padded.length < bracketSize) {
      padded.push({ id: `bye-${padded.length}`, name: 'BYE', isBye: true });
    }

    // Generate rounds
    const rounds = [];
    let roundSize = bracketSize;
    let roundPlayers = [...padded];

    while (roundSize >= 2) {
      const matches = [];
      for (let i = 0; i < roundSize; i += 2) {
        const match = {
          id: `match-${rounds.length}-${i/2}`,
          round: rounds.length,
          matchNumber: i / 2,
          player1: roundPlayers[i],
          player2: roundPlayers[i + 1],
          winner: null,
          status: rounds.length === 0 ? 'pending' : 'waiting', // pending, active, finished, waiting
          scores: { player1: 0, player2: 0 },
          games: [],
        };
        
        // Auto-advance BYEs
        if (match.player1.isBye) {
          match.winner = match.player2;
          match.status = 'finished';
        } else if (match.player2.isBye) {
          match.winner = match.player1;
          match.status = 'finished';
        }
        
        matches.push(match);
      }
      
      rounds.push({
        round: rounds.length,
        name: roundSize === 2 ? 'Final' : roundSize === 4 ? 'Semi-Final' : `Round of ${roundSize}`,
        matches,
      });
      
      roundSize /= 2;
      // Next round players are winners of current matches
      roundPlayers = matches.map(() => ({ id: 'tbd', name: 'TBD' }));
    }

    return {
      format,
      rounds,
      totalRounds: rounds.length,
    };
  },

  // Start tournament
  start(tournamentId) {
    const tournament = this.load(tournamentId);
    if (!tournament) return null;
    
    if (tournament.players.length < tournament.minPlayers) {
      return { error: `Need at least ${tournament.minPlayers} players` };
    }
    
    tournament.status = 'active';
    tournament.bracket = this.generateBracket(tournament.players, tournament.format);
    tournament.rounds = tournament.bracket.rounds;
    tournament.currentRound = 0;
    
    this.save(tournament);
    return tournament;
  },

  // Get current round matches
  getCurrentMatches(tournamentId) {
    const tournament = this.load(tournamentId);
    if (!tournament || !tournament.rounds) return [];
    
    const currentRound = tournament.rounds[tournament.currentRound];
    return currentRound ? currentRound.matches : [];
  },

  // Record match result
  recordMatchResult(tournamentId, matchId, winnerId, scores) {
    const tournament = this.load(tournamentId);
    if (!tournament) return null;
    
    // Find match
    let match = null;
    let roundIdx = -1;
    
    for (let i = 0; i < tournament.rounds.length; i++) {
      const found = tournament.rounds[i].matches.find(m => m.id === matchId);
      if (found) {
        match = found;
        roundIdx = i;
        break;
      }
    }
    
    if (!match) return null;
    
    match.winner = match.player1.id === winnerId ? match.player1 : match.player2;
    match.status = 'finished';
    match.scores = scores;
    match.finishedAt = new Date().toISOString();
    
    // Advance winner to next round
    if (roundIdx < tournament.rounds.length - 1) {
      const nextRound = tournament.rounds[roundIdx + 1];
      const nextMatchIndex = Math.floor(match.matchNumber / 2);
      const nextMatch = nextRound.matches[nextMatchIndex];
      
      if (match.matchNumber % 2 === 0) {
        nextMatch.player1 = match.winner;
      } else {
        nextMatch.player2 = match.winner;
      }
      
      // Check if both players are set
      if (nextMatch.player1.id !== 'tbd' && nextMatch.player2.id !== 'tbd') {
        nextMatch.status = 'pending';
      }
    }
    
    // Check if round is complete
    const currentRound = tournament.rounds[tournament.currentRound];
    const roundComplete = currentRound.matches.every(m => m.status === 'finished');
    
    if (roundComplete) {
      if (tournament.currentRound === tournament.rounds.length - 1) {
        // Tournament finished
        tournament.status = 'finished';
        tournament.winner = match.winner;
        tournament.finishedAt = new Date().toISOString();
      } else {
        // Advance to next round
        tournament.currentRound++;
      }
    }
    
    this.save(tournament);
    return tournament;
  },

  // Get tournament leaderboard
  getLeaderboard(tournamentId) {
    const tournament = this.load(tournamentId);
    if (!tournament) return [];
    
    const stats = {};
    
    // Initialize stats for all players
    tournament.players.forEach(p => {
      stats[p.id] = {
        ...p,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rank: null,
      };
    });
    
    // Calculate from matches
    tournament.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.status !== 'finished' || match.player1.isBye || match.player2.isBye) return;
        
        const p1 = stats[match.player1.id];
        const p2 = stats[match.player2.id];
        
        if (match.winner?.id === match.player1.id) {
          p1.wins++;
          p2.losses++;
        } else {
          p2.wins++;
          p1.losses++;
        }
        
        p1.gamesWon += match.scores.player1 || 0;
        p1.gamesLost += match.scores.player2 || 0;
        p2.gamesWon += match.scores.player2 || 0;
        p2.gamesLost += match.scores.player1 || 0;
      });
    });
    
    // Convert to array and sort
    const leaderboard = Object.values(stats).sort((a, b) => {
      // Sort by wins (desc), then by win ratio
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aRatio = a.gamesWon / (a.gamesWon + a.gamesLost) || 0;
      const bRatio = b.gamesWon / (b.gamesWon + b.gamesLost) || 0;
      return bRatio - aRatio;
    });
    
    // Assign ranks
    leaderboard.forEach((p, i) => p.rank = i + 1);
    
    return leaderboard;
  },

  // List all tournaments
  listAll() {
    try {
      const tournaments = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('tournament:')) {
          const id = key.replace('tournament:', '');
          const tourney = this.load(id);
          if (tourney) {
            tournaments.push({
              id: tourney.id,
              name: tourney.name,
              status: tourney.status,
              playerCount: tourney.players.length,
              createdAt: tourney.createdAt,
              winner: tourney.winner,
            });
          }
        }
      }
      return tournaments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      return [];
    }
  },

  // Delete tournament
  delete(tournamentId) {
    try {
      localStorage.removeItem(this.key(tournamentId));
      return true;
    } catch (e) {
      return false;
    }
  },
};

// Export for use
Object.assign(window, { TournamentAdapter });
