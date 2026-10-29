import { Server, Socket } from "socket.io";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rqtlqqmdldpsrtuviedy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdGxxcW1kbGRwc3J0dXZpZWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDgyOTQsImV4cCI6MjA4NTI4NDI5NH0.egKKScXyTjpS6NcOI1oZT-nCU3IKu_1h5xA48ZN4nSM";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// AI Validation is now handled by the client to follow security guidelines
// and avoid backend API key issues.

interface Player {
  id: string;
  name: string;
  score: number;
  currentAnswer: string;
  isReady: boolean;
}

interface Challenge {
  category: string;
  letter: string;
  label: string;
}

interface Room {
  id: string;
  players: Record<string, Player>;
  state: 'waiting' | 'spinning' | 'playing' | 'round_results' | 'game_over';
  currentChallenge: Challenge | null;
  timer: number;
  round: number;
  maxRounds: number;
  answers: Record<string, { answer: string, isCorrect: boolean, points: number }>;
}

const rooms: Record<string, Room> = {};

const CATEGORIES = [
  { id: 'title', name: 'Títulos' },
  { id: 'director', name: 'Diretores' },
  { id: 'animation', name: 'Desenhos' },
  { id: 'theme', name: 'Temas' }
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function getRandomChallenge(): Challenge {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return {
    category: category.id,
    letter: letter,
    label: `${category.name} com a letra ${letter}`
  };
}

export function setupGameSockets(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log("User connected to game:", socket.id);

    socket.on("join_room", ({ roomId, playerName }) => {
      socket.join(roomId);
      
      if (!rooms[roomId]) {
        rooms[roomId] = {
          id: roomId,
          players: {},
          state: 'waiting',
          currentChallenge: null,
          timer: 0,
          round: 0,
          maxRounds: 5,
          answers: {}
        };
      }
      
      rooms[roomId].players[socket.id] = {
        id: socket.id,
        name: playerName,
        score: 0,
        currentAnswer: '',
        isReady: false
      };
      
      io.to(roomId).emit("room_state", rooms[roomId]);
    });

    socket.on("start_game", ({ roomId }) => {
      const room = rooms[roomId];
      if (room && room.state === 'waiting') {
        startRound(roomId, io);
      }
    });

    socket.on("submit_answer", ({ roomId, answer }) => {
      const room = rooms[roomId];
      if (room && room.state === 'playing') {
        if (room.players[socket.id]) {
          room.players[socket.id].currentAnswer = answer;
        }
      }
    });

    socket.on("validation_results", ({ roomId, results }) => {
      const room = rooms[roomId];
      if (room && room.state === 'round_results') {
        // Apply AI validation results from client
        Object.entries(results).forEach(([playerId, isCorrect]: [string, any]) => {
          if (room.answers[playerId] && !room.answers[playerId].isCorrect && isCorrect) {
            room.answers[playerId].isCorrect = true;
            room.answers[playerId].points = 10;
            if (room.players[playerId]) {
              room.players[playerId].score += 10;
            }
          }
        });
        io.to(roomId).emit("room_state", room);
      }
    });

    socket.on("disconnect", () => {
      // Find room and remove player
      for (const roomId in rooms) {
        if (rooms[roomId].players[socket.id]) {
          delete rooms[roomId].players[socket.id];
          if (Object.keys(rooms[roomId].players).length === 0) {
            delete rooms[roomId];
          } else {
            io.to(roomId).emit("room_state", rooms[roomId]);
          }
        }
      }
    });
  });
}

function startRound(roomId: string, io: Server) {
  const room = rooms[roomId];
  if (!room) return;

  room.round += 1;
  room.state = 'spinning';
  room.currentChallenge = getRandomChallenge();
  room.answers = {};
  
  // Reset player answers
  Object.values(room.players).forEach(p => p.currentAnswer = '');

  io.to(roomId).emit("room_state", room);

  // Spin for 3 seconds
  setTimeout(() => {
    room.state = 'playing';
    room.timer = 15;
    io.to(roomId).emit("room_state", room);

    const interval = setInterval(() => {
      room.timer -= 1;
      io.to(roomId).emit("timer_update", room.timer);

      if (room.timer <= 0) {
        clearInterval(interval);
        evaluateAnswers(roomId, io);
      }
    }, 1000);
  }, 3000);
}

async function evaluateAnswers(roomId: string, io: Server) {
  const room = rooms[roomId];
  if (!room || !room.currentChallenge) return;

  room.state = 'round_results';
  io.to(roomId).emit("room_state", room);

  // Evaluate each player's answer against Supabase
  const challenge = room.currentChallenge;
  
  for (const player of Object.values(room.players)) {
    const answer = player.currentAnswer.trim();
    let isCorrect = false;
    let points = 0;

    if (answer.length > 0) {
      // 1. Check Supabase (Exact or partial match)
      try {
        let query = supabase.from('movies').select('id').ilike('title', `${answer}%`);
        
        if (challenge.category === 'director') {
          query = supabase.from('movies').select('id').ilike('director', `${answer}%`);
        } else if (challenge.category === 'animation') {
          query = supabase.from('movies').select('id').contains('genres', ['Animação']).ilike('title', `${answer}%`);
        } else if (challenge.category === 'theme') {
          query = supabase.from('movies').select('id').contains('themes', [answer]);
        }

        const { data, error } = await query.limit(1);
        
        if (!error && data && data.length > 0) {
          isCorrect = true;
        }

        if (isCorrect) {
          points = 10;
          player.score += points;
        }
      } catch (e) {
        console.error("Error validating answer:", e);
      }
    }

    room.answers[player.id] = { answer, isCorrect, points };
  }

  io.to(roomId).emit("room_state", room);

  // Request AI validation from the first player (host)
  const hostId = Object.keys(room.players)[0];
  if (hostId) {
    const pendingValidation = Object.entries(room.answers)
      .filter(([_, data]) => !data.isCorrect && data.answer.length > 0)
      .map(([playerId, data]) => ({ playerId, answer: data.answer }));

    if (pendingValidation.length > 0) {
      io.to(hostId).emit("request_validation", {
        roomId,
        challenge,
        answers: pendingValidation
      });
    }
  }

  // Wait 5 seconds then next round or game over
  setTimeout(() => {
    if (room.round >= room.maxRounds) {
      room.state = 'game_over';
      io.to(roomId).emit("room_state", room);
    } else {
      startRound(roomId, io);
    }
  }, 5000);
}
