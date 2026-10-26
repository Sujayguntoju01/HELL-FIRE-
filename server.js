const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, game: "HELL FIRE Mini Arena" }));

const rooms = new Map();
const COLORS = ["#ff405d", "#36d9ff", "#bd70ff", "#ffca58"];
const ARENA = { w: 1000, h: 620 };
const ROUND_MS = 180000;
const TICK_MS = 50;

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out;
  do {
    out = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(out));
  return out;
}
function publicRoom(room) {
  return {
    code: room.code, phase: room.phase, hostId: room.hostId,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, color: p.color, ready: p.ready,
      x: p.x, y: p.y, hp: p.hp, score: p.score, alive: p.alive
    })),
    timeLeft: room.phase === "playing" ? Math.max(0, room.endsAt - Date.now()) : (room.durationMs || ROUND_MS),
    pickups: room.pickups
  };
}
function broadcast(room) { io.to(room.code).emit("state", publicRoom(room)); }
function makePlayer(id, name, index) {
  return {
    id, name: String(name || "Player").trim().slice(0, 16) || "Player",
    color: COLORS[index % COLORS.length], ready: false,
    x: 150 + index * 220, y: 150 + (index % 2) * 300,
    hp: 100, score: 0, alive: true, lastShot: 0, input: {},
    lastHit: 0
  };
}
function resetRound(room, durationSeconds = 180) {
  let i = 0;
  for (const p of room.players.values()) {
    p.x = 150 + i * 220; p.y = 150 + (i % 2) * 300;
    p.hp = 100; p.score = 0; p.alive = true; p.lastShot = 0; p.input = {};
    i++;
  }
  room.projectiles = [];
  room.pickups = [];
  room.nextPickup = Date.now() + 3500;
  room.phase = "playing";
  room.durationMs = Math.max(60, Math.min(600, Number(durationSeconds) || 180)) * 1000;
  room.endsAt = Date.now() + room.durationMs;
  room.winnerId = null;
}
function finishRound(room) {
  if (room.phase !== "playing") return;
  room.phase = "ended";
  const alive = [...room.players.values()].filter(p => p.alive);
  let winner = null;
  if (alive.length === 1) winner = alive[0];
  else winner = [...room.players.values()].sort((a,b) => b.score-a.score || b.hp-a.hp)[0] || null;
  room.winnerId = winner?.id || null;
  io.to(room.code).emit("roundOver", {
    winnerId: room.winnerId,
    winnerName: winner?.name || "Nobody",
    reason: alive.length === 1 ? "last standing" : "time expired"
  });
  broadcast(room);
}
function startRoom(room, durationSeconds = 180) {
  if (room.phase === "playing" || room.players.size < 2) return false;
  resetRound(room, durationSeconds);
  broadcast(room);
  return true;
}
function leaveRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  socket.leave(roomCode);
  socket.data.roomCode = null;
  if (!room) return;
  room.players.delete(socket.id);
  if (room.players.size === 0) {
    clearInterval(room.timer);
    rooms.delete(roomCode);
    return;
  }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  if (room.phase === "playing" && room.players.size < 2) finishRound(room);
  broadcast(room);
}
function distance(a,b) { return Math.hypot(a.x-b.x, a.y-b.y); }

io.on("connection", socket => {
  socket.on("createRoom", ({name}, cb = () => {}) => {
    if (socket.data.roomCode) leaveRoom(socket);
    const roomCode = code();
    const room = {
      code: roomCode, hostId: socket.id, players: new Map(),
      phase: "lobby", projectiles: [], pickups: [], endsAt: 0,
      nextPickup: Date.now() + 3500, winnerId: null
    };
    room.players.set(socket.id, makePlayer(socket.id, name, 0));
    room.timer = setInterval(() => tick(room), TICK_MS);
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    cb({ok:true, code:roomCode});
    broadcast(room);
  });
  socket.on("joinRoom", ({code: requested, name}, cb = () => {}) => {
    const roomCode = String(requested || "").toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return cb({ok:false, error:"Room not found. Check the code or create a new room."});
    if (room.phase === "playing") return cb({ok:false, error:"This match is already in progress."});
    if (room.players.size >= 4) return cb({ok:false, error:"This room is full (4 players maximum)."});
    if (socket.data.roomCode) leaveRoom(socket);
    room.players.set(socket.id, makePlayer(socket.id, name, room.players.size));
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    cb({ok:true, code:roomCode});
    broadcast(room);
  });
  socket.on("ready", () => {
    const room = rooms.get(socket.data.roomCode);
    const p = room?.players.get(socket.id);
    if (!p || room.phase !== "lobby") return;
    p.ready = !p.ready;
    broadcast(room);
  });
  socket.on("startGame", (options = {}, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ok:false, error:"Room no longer exists."});
    if (room.hostId !== socket.id) return cb?.({ok:false, error:"Only the host can start the match."});
    if (room.players.size < 2) return cb?.({ok:false, error:"At least 2 players are needed."});
    if ([...room.players.values()].some(p => !p.ready)) return cb?.({ok:false, error:"Everyone must press Ready first."});
    const ok = startRoom(room, options.durationSeconds);
    cb?.({ok, error:ok ? undefined : "Unable to start match."});
  });
  socket.on("input", data => {
    const room = rooms.get(socket.data.roomCode);
    const p = room?.players.get(socket.id);
    if (!p || room.phase !== "playing" || !p.alive) return;
    p.input = {
      up: !!data.up, down: !!data.down, left: !!data.left, right: !!data.right,
      aimX: Math.max(0, Math.min(ARENA.w, Number(data.aimX) || p.x)),
      aimY: Math.max(0, Math.min(ARENA.h, Number(data.aimY) || p.y)),
      fire: !!data.fire
    };
  });
  socket.on("backToLobby", cb => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ok:false, error:"Room no longer exists."});
    if (room.hostId !== socket.id) return cb?.({ok:false, error:"Only the host can return the room to the lobby."});
    if (room.phase === "playing") return cb?.({ok:false, error:"Finish the match before returning to the lobby."});
    room.phase = "lobby";
    room.winnerId = null;
    room.projectiles = [];
    room.pickups = [];
    for (const p of room.players.values()) p.ready = false;
    broadcast(room);
    cb?.({ok:true});
  });
  socket.on("rematch", (options = {}, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ok:false, error:"Room no longer exists."});
    if (room.hostId !== socket.id) return cb?.({ok:false, error:"Only the host can start a rematch."});
    if (room.players.size < 2) return cb?.({ok:false, error:"At least 2 players are needed."});
    for (const p of room.players.values()) p.ready = true;
    startRoom(room, options.durationSeconds);
    cb?.({ok:true});
  });
  socket.on("disconnect", () => leaveRoom(socket));
});

function tick(room) {
  if (!rooms.has(room.code)) return;
  const now = Date.now();
  if (room.phase === "playing") {
    if (now >= room.endsAt) { finishRound(room); return; }
    for (const p of room.players.values()) {
      if (!p.alive) continue;
      const i = p.input || {};
      let dx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
      let dy = (i.down ? 1 : 0) - (i.up ? 1 : 0);
      const mag = Math.hypot(dx,dy) || 1;
      p.x = Math.max(24, Math.min(ARENA.w-24, p.x + dx/mag*4.2));
      p.y = Math.max(24, Math.min(ARENA.h-24, p.y + dy/mag*4.2));
      if (i.fire && now - p.lastShot > 330) {
        const ax = i.aimX - p.x, ay = i.aimY - p.y, len = Math.hypot(ax,ay) || 1;
        room.projectiles.push({ownerId:p.id, x:p.x, y:p.y, vx:ax/len*9, vy:ay/len*9, born:now});
        p.lastShot = now;
      }
    }
    for (const b of room.projectiles) { b.x += b.vx; b.y += b.vy; }
    room.projectiles = room.projectiles.filter(b =>
      b.x >= 0 && b.y >= 0 && b.x <= ARENA.w && b.y <= ARENA.h && now-b.born < 1800
    );
    for (const b of [...room.projectiles]) {
      const target = [...room.players.values()].find(p => p.id !== b.ownerId && p.alive && Math.hypot(p.x-b.x,p.y-b.y)<20);
      if (target) {
        const shooter = room.players.get(b.ownerId);
        if (shooter) shooter.score += 10;
        target.hp -= 25;
        room.projectiles.splice(room.projectiles.indexOf(b),1);
        if (target.hp <= 0) {
          target.hp = 0; target.alive = false;
          if (shooter) shooter.score += 100;
        }
      }
    }
    if (now >= room.nextPickup && room.pickups.length < 3) {
      room.pickups.push({id: `${now}-${Math.random()}`, x: 70+Math.random()*(ARENA.w-140), y:70+Math.random()*(ARENA.h-140)});
      room.nextPickup = now + 7000;
    }
    for (const pickup of [...room.pickups]) {
      const player = [...room.players.values()].find(p => p.alive && Math.hypot(p.x-pickup.x,p.y-pickup.y)<28);
      if (player) {
        player.score += 25;
        room.pickups = room.pickups.filter(q => q.id !== pickup.id);
      }
    }
    if ([...room.players.values()].filter(p=>p.alive).length <= 1) finishRound(room);
  }
  io.to(room.code).emit("frame", {
    players: [...room.players.values()].map(p=>({id:p.id,x:p.x,y:p.y,hp:p.hp,score:p.score,alive:p.alive})),
    projectiles: room.projectiles,
    timeLeft: room.phase === "playing" ? Math.max(0,room.endsAt-now) : ROUND_MS,
    pickups: room.pickups
  });
  if (now % 200 < TICK_MS) broadcast(room);
}

server.listen(PORT, "0.0.0.0", () => console.log(`HELL FIRE Mini Arena running on port ${PORT}`));
