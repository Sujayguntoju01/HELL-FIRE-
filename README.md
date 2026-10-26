# HELL FIRE

A first playable real-time 2–4 player top-down arena prototype. It uses Node.js, Express, and Socket.IO. The server owns movement, projectiles, hit detection, pickups, scoring, and match timing.

## Requirements
- Node.js 18 or newer
- Internet connection for the first dependency install

## Run locally
1. Extract this ZIP.
2. Open a terminal in the `hellfire-mini-arena` folder.
3. Run `npm install`
4. Run `npm start`
5. Open `http://localhost:3000`

To test multiplayer on one computer, open two separate browser sessions (normal + private/incognito). Create a room in one, join using the displayed four-character code in the other, and have both players press Ready. The host presses Start Match.

To test from another device on the same Wi-Fi, find the computer's LAN IP address and open `http://YOUR-LAN-IP:3000` on the other device. Allow Node.js through the local firewall if prompted. `localhost` itself only points to the device you're currently using.

## Controls
- Move: WASD or arrow keys
- Aim: mouse; on touch devices, drag on the arena
- Fire: hold mouse/touch on arena or Space
- Mobile movement: on-screen direction pad; Fire button

## Rules
- 2–4 players per room, four-character room code.
- All players must mark Ready; only the host can start.
- 100 health per player; each hit deals 25 damage.
- Hit = 10 points; elimination = 100 bonus points; pickup = 25 points.
- Pickups spawn periodically and restore no health; they award points.
- Round lasts up to 3 minutes. Last survivor wins. If time expires, highest score wins, then highest remaining health breaks a tie.
- Rematch can be started by the host after the round.

## Public deployment (recommended)
This project needs a persistent Node.js host that supports WebSockets; a static-only host is not sufficient because the game server must run continuously.

### Option 1: Render (simple)
1. Create a GitHub repository and upload the contents of this folder.
2. In Render, create a **Web Service** connected to that repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Choose a Node runtime and deploy. The app listens on `process.env.PORT` and binds to `0.0.0.0`.
6. Open the deployed HTTPS URL. Render supports WebSockets on web services; Socket.IO will connect using the same origin.
7. Test by opening the URL on two devices or a normal and private browser session.

Free hosting availability and sleep/usage limits can change. Check the provider's current plan before relying on it for a demo.

### Option 2: Railway or another Node/WebSocket host
Deploy the repository as a Node.js service with `npm install` and `npm start`, then test the public HTTPS URL.

## Important notes
- This is a prototype, not a hardened production service. There is no account system, chat, persistent leaderboard, or reconnect recovery.
- Room state is held in server memory. Restarting the service ends all rooms.
- For a public release, add rate limiting, stricter server-side input validation, connection/reconnect handling, and basic abuse prevention.
- The public URL is not created by this ZIP. You must deploy it to a hosting provider and verify the deployed site.
\n## Game modes\n\n- **Single Player:** start instantly and fight three AI bots. No room code or second player is required.\n- **Multiplayer:** create a room and share the four-character code, or join a friend’s room.\n
## Latest update

The home screen includes a round-length selector (1, 2, 3, 5, or 10 minutes), player avatar choices, and selectable arena backgrounds using the two supplied artworks. Single-player mode includes timed explosive bombs; click Play Again to restart a solo match. Multiplayer host duration selection is passed to the server.


Recent single-player updates: fixed Arcade Sunset background, expanded 1200×760 local arena, five AI opponents, extra arena props and more frequent bombs, and a point-based bullet shop (Rapid Fire, Heavy Rounds, Plasma Blast). The START SINGLE PLAYER button launches a match using the selected timer.
