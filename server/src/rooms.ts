// In-memory multiplayer rooms (single server instance is fine for Coolify; move to Redis only if you scale out).
import { randomBytes } from "node:crypto";

export type Mode = "lastAlive" | "firstFall" | "targetHeight" | "highScore";
export type Status = "lobby" | "countdown" | "playing" | "done";

export interface Player {
  id: string;
  name: string;
  character: string | null;
  ready: boolean;
  height: number;
  score: number;
  x: number; // horizontal position on the shared board (for opponent ghosts)
  alive: boolean;
  finished: boolean; // reached target / fell — i.e. done racing
  send(msg: unknown): void;
}

export interface Room {
  code: string;
  mode: Mode;
  targetHeight: number;
  hostId: string;
  players: Player[];
  status: Status;
  seed: number; // shared RNG seed so every client builds the identical map
  timer?: ReturnType<typeof setInterval>;
}

const rooms = new Map<string, Room>();
const MAX_PLAYERS = 4;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

export function newPlayerId(): string {
  return randomBytes(8).toString("hex");
}

function genCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return rooms.has(code) ? genCode() : code;
}

export function publicRoom(room: Room) {
  return {
    code: room.code,
    mode: room.mode,
    targetHeight: room.targetHeight,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({
      id: p.id, name: p.name, character: p.character, ready: p.ready,
      alive: p.alive, height: p.height, score: p.score,
    })),
  };
}

export function broadcast(room: Room, msg: unknown): void {
  for (const p of room.players) { try { p.send(msg); } catch { /* dead socket */ } }
}
export function broadcastRoom(room: Room): void {
  broadcast(room, { type: "room", room: publicRoom(room) });
}

export function createRoom(player: Player, mode: Mode, targetHeight: number): Room {
  const room: Room = { code: genCode(), mode, targetHeight, hostId: player.id, players: [player], status: "lobby", seed: 0 };
  rooms.set(room.code, room);
  return room;
}

export function joinRoom(code: string, player: Player): { room?: Room; error?: string } {
  const room = rooms.get((code || "").toUpperCase());
  if (!room) return { error: "room not found" };
  if (room.status !== "lobby") return { error: "game already started" };
  if (room.players.length >= MAX_PLAYERS) return { error: "room full" };
  room.players.push(player);
  return { room };
}

// Quick-match: first open lobby, else spin up a new public room.
export function quickMatch(player: Player): Room {
  for (const room of rooms.values()) {
    if (room.status === "lobby" && room.players.length < MAX_PLAYERS) { room.players.push(player); return room; }
  }
  return createRoom(player, "lastAlive", 3000);
}

export function pickCharacter(room: Room, player: Player, character: string): boolean {
  if (room.players.some((p) => p !== player && p.character === character)) return false; // taken
  player.character = character;
  return true;
}

export function canStart(room: Room): string | null {
  if (room.players.length < 2) return "need at least 2 players";
  if (room.players.some((p) => !p.character)) return "everyone must pick a character";
  if (room.players.some((p) => !p.ready)) return "everyone must be ready";
  return null;
}

export function startCountdown(room: Room): void {
  room.status = "countdown";
  room.seed = Math.floor(Math.random() * 0x7fffffff) || 1; // shared map seed for this race
  broadcastRoom(room);
  let n = 3;
  broadcast(room, { type: "countdown", n });
  room.timer = setInterval(() => {
    n -= 1;
    if (n > 0) { broadcast(room, { type: "countdown", n }); return; }
    clearInterval(room.timer);
    room.timer = undefined;
    room.status = "playing";
    for (const p of room.players) { p.alive = true; p.finished = false; p.height = 0; p.score = 0; p.x = 0; }
    broadcast(room, { type: "start", seed: room.seed }); // everyone builds the same level from this seed
  }, 1000);
}

export function rankPlayers(room: Room) {
  // alive players first, then by score (height climbed) descending
  return room.players
    .slice()
    .sort((a, b) => (Number(b.alive) - Number(a.alive)) || (b.score - a.score))
    .map((p) => ({ id: p.id, name: p.name, character: p.character, score: p.score, height: p.height, alive: p.alive }));
}

export function finishRace(room: Room): void {
  if (room.status === "done") return;
  room.status = "done";
  broadcast(room, { type: "end", mode: room.mode, standings: rankPlayers(room) });
}

// Apply the room's mode end-condition after a state update; returns true if the race just ended.
export function checkEnd(room: Room): boolean {
  if (room.status !== "playing") return false;
  const aliveCount = room.players.filter((p) => p.alive).length;
  let ended = false;
  switch (room.mode) {
    case "lastAlive": ended = room.players.length >= 2 ? aliveCount <= 1 : aliveCount === 0; break;
    case "firstFall": ended = room.players.some((p) => !p.alive); break;
    case "targetHeight": ended = room.players.some((p) => p.score >= room.targetHeight); break;
    case "highScore": ended = aliveCount === 0; break;
  }
  if (ended) finishRace(room);
  return ended;
}

// Rematch: put a finished room back in the lobby, keeping players + their characters.
export function resetToLobby(room: Room): void {
  if (room.timer) { clearInterval(room.timer); room.timer = undefined; }
  room.status = "lobby";
  for (const p of room.players) { p.ready = false; p.alive = true; p.finished = false; p.score = 0; p.height = 0; }
  broadcastRoom(room);
}

export function leaveRoom(room: Room, player: Player): void {
  room.players = room.players.filter((p) => p !== player);
  if (room.players.length === 0) {
    if (room.timer) clearInterval(room.timer);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === player.id) room.hostId = room.players[0]!.id;
  if (room.status === "playing" && room.players.length <= 1) { finishRace(room); return; } // last one standing wins
  broadcastRoom(room);
}
