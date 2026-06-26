import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import * as R from "./rooms.js";

const MODES: R.Mode[] = ["lastAlive", "firstFall", "targetHeight", "highScore"];

export function setupWebSocket(server: Server, basePath = ""): void {
  const wss = new WebSocketServer({ server, path: (basePath || "") + "/ws" });

  wss.on("connection", (socket: WebSocket) => {
    const player: R.Player = {
      id: R.newPlayerId(),
      name: "player", character: null, ready: false,
      height: 0, score: 0, x: 0, alive: true, finished: false,
      send: (msg) => { try { socket.send(JSON.stringify(msg)); } catch { /* dead socket */ } },
    };
    let room: R.Room | undefined;
    player.send({ type: "hello", id: player.id });

    socket.on("message", (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      const name = () => { player.name = String(msg.name || "player").trim().slice(0, 24) || "player"; };

      switch (msg.type) {
        case "create": {
          name();
          const mode: R.Mode = MODES.includes(msg.mode) ? msg.mode : "lastAlive";
          room = R.createRoom(player, mode, Math.max(500, Number(msg.targetHeight) || 3000));
          player.send({ type: "joined", code: room.code, id: player.id });
          R.broadcastRoom(room);
          break;
        }
        case "join": {
          name();
          const res = R.joinRoom(String(msg.code || ""), player);
          if (res.error || !res.room) { player.send({ type: "error", error: res.error || "join failed" }); break; }
          room = res.room;
          player.send({ type: "joined", code: room.code, id: player.id });
          R.broadcastRoom(room);
          break;
        }
        case "quickmatch": {
          name();
          room = R.quickMatch(player);
          player.send({ type: "joined", code: room.code, id: player.id });
          R.broadcastRoom(room);
          break;
        }
        case "pick": {
          if (!room) break;
          if (!R.pickCharacter(room, player, String(msg.character || ""))) player.send({ type: "error", error: "character taken" });
          R.broadcastRoom(room);
          break;
        }
        case "ready": {
          if (!room) break;
          player.ready = !!msg.ready;
          R.broadcastRoom(room);
          break;
        }
        case "start": {
          if (!room || room.hostId !== player.id) break;
          const err = R.canStart(room);
          if (err) { player.send({ type: "error", error: err }); break; }
          R.startCountdown(room);
          break;
        }
        case "state": {
          if (!room || room.status !== "playing") break;
          player.height = Number(msg.height) || 0;
          player.score = Number(msg.score) || 0;
          player.x = Number(msg.x) || 0;
          if (msg.alive === false) player.alive = false;
          // relay everyone's live state (for the opponent ghosts + HUD), then apply the mode's end-condition
          R.broadcast(room, {
            type: "players",
            players: room.players.map((p) => ({ id: p.id, name: p.name, character: p.character, height: p.height, score: p.score, x: p.x, alive: p.alive })),
          });
          R.checkEnd(room); // may broadcast { type: "end", standings } and flip status to "done"
          break;
        }
        case "rematch": {
          if (!room || room.hostId !== player.id) break;
          R.resetToLobby(room); // back to lobby, keep players + characters
          break;
        }
        case "leave": {
          if (room) { R.leaveRoom(room, player); room = undefined; }
          break;
        }
      }
    });

    socket.on("close", () => { if (room) { R.leaveRoom(room, player); room = undefined; } });
    socket.on("error", () => { if (room) { R.leaveRoom(room, player); room = undefined; } });
  });
}
