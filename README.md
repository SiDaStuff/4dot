# Pieces by Sing Gaming

A strategic multiplayer piece game. Place your pieces, outmaneuver your opponent, and connect three to win.

## Tech Stack

- Vite
- React 19
- TypeScript
- Firebase Authentication
- Node.js/Express API server
- Firebase Admin SDK for Firestore and Realtime Database
- Server-sent events for live game updates
- Glicko-2 ratings
- PWA support

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file from `.env.example` and fill in your Firebase client and admin values.

3. Enable Firebase Authentication providers:

   - Email/password
   - Google

4. Deploy locked-down database rules:

   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only database:rules
   ```

## Development

Run the API server and the Vite app in separate terminals:

```bash
npm run dev:server
npm run dev
```

The app runs on `http://localhost:3000` and the API server runs on `http://localhost:3001`.

## Build

```bash
npm run build
```

Output is written to `dist/`.

## Game Rules

- Board: 5x5 grid
- Pieces: 8 black pieces and 8 white pieces
- Goal: connect 3 pieces in a row, column, or diagonal
- Placement: players alternate placing pieces on empty squares
- Movement: after all pieces are placed, move one piece per turn like a chess king
- Draws: threefold repetition or 100 half-moves without a winner

## Security Model

Browser clients use Firebase Auth only for identity. Game state, profiles, matchmaking, leaderboards, friends, username changes, password resets, and live updates go through the Node.js API server. Firestore and Realtime Database rules are set to deny direct client reads and writes.

## License

Sing Gaming copyright 2024
