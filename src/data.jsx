// Static seed data for the prototype

window.APP_DATA = {
  currentUser: {
    id: 'me',
    name: 'You',
    avatar: '🦊',
    color: '#ff3c7a',
  },

  avatars: ['🦊','🐸','🐙','🐼','🦄','🐲','🐧','🦉','🐯','🦁','🐵','🐰','🐨','🐻','🐶','🐱','👾','🤖','👻','🎃','🍄','🌮','🍕','🌈','⚡','🔥','🌟','🍉'],

  avatarBg: ['#ff4d6d','#ffc93c','#3ddc84','#4a8cff','#7b5cff','#3ddcc8','#ff7b3c','#e84ac4','#8a7dff','#ff6bab','#6acfff','#f5a623'],

  felts: [
    { id: 'classic', name: 'Classic Green', cls: 'felt-classic' },
    { id: 'neon', name: 'Neon Grid', cls: 'felt-neon' },
    { id: 'candy', name: 'Candy Pink', cls: 'felt-candy' },
    { id: 'midnight', name: 'Midnight', cls: 'felt-midnight' },
    { id: 'jungle', name: 'Jungle', cls: 'felt-jungle' },
    { id: 'sunset', name: 'Sunset', cls: 'felt-sunset' },
  ],

  cardBacks: [
    { id: 'classic', name: 'Classic', swatch: '#5b2bb2' },
    { id: 'galaxy', name: 'Galaxy', swatch: '#1a0a4a' },
    { id: 'flame', name: 'Flame', swatch: '#ff3c7a' },
    { id: 'mint', name: 'Mint', swatch: '#3ddcc8' },
    { id: 'sunny', name: 'Sunny', swatch: '#ffc93c' },
    { id: 'inky', name: 'Inky', swatch: '#0a0418' },
  ],

  roomIcons: ['🎉','🔥','⚡','🌈','🎰','🎲','🃏','🎭','👑','🦄','🌮','🍕','🎮','🚀','🌟','💎'],

  houseRules: [
    {
      id: 'stack',
      name: 'Stack Attack',
      desc: 'Stack +2 and +4 cards. Next player adds their own or draws the total.',
      on: true,
      emoji: '🥞',
    },
    {
      id: 'sevenZero',
      name: '7-0 Swap',
      desc: 'Play a 7 to swap hands with someone. Play a 0 to rotate all hands.',
      on: true,
      emoji: '🔄',
    },
    {
      id: 'jumpIn',
      name: 'Jump-In',
      desc: 'Play an identical card out of turn to interrupt the flow.',
      on: false,
      emoji: '🏃',
    },
    {
      id: 'progressive',
      name: 'Progressive SHOUT',
      desc: 'Last card must be played with a flourish — slam the table!',
      on: false,
      emoji: '💥',
    },
    {
      id: 'challenge',
      name: 'Challenge Wild +4',
      desc: 'Suspect an illegal +4? Challenge — loser draws extra.',
      on: true,
      emoji: '⚖️',
    },
    {
      id: 'drawPlay',
      name: 'Draw Until Playable',
      desc: 'Must keep drawing until you get a card you can play.',
      on: false,
      emoji: '📚',
    },
    {
      id: 'noMercy',
      name: 'No Mercy',
      desc: 'Forget to call SHOUT? +2 penalty. No do-overs.',
      on: true,
      emoji: '😈',
    },
    {
      id: 'blankCards',
      name: 'Blank Cards',
      desc: 'Include custom-designed blank wild cards with unique effects.',
      on: false,
      emoji: '🎨',
    },
    {
      id: 'points',
      name: 'Points Scoring',
      desc: 'Play to 500 pts across multiple rounds instead of single hand.',
      on: true,
      emoji: '💯',
    },
    {
      id: 'noSpecialFinish',
      name: 'No Special Finish',
      desc: "Can't win on an action or wild card — your last card must be a plain number.",
      on: true,
      emoji: '🏁',
    },
  ],

  // Runtime data (rooms, games, leaderboard, history, custom cards)
  // now comes from dbAdapter + backend APIs or localStorage fallback.
};
