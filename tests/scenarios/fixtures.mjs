export const compactGoalFormations = Object.freeze({
  home: Object.freeze([
    { x: 90, y: 350, role: "GK", name: "KAI", number: 1, rating: 86 },
    { x: 260, y: 120, role: "DF", name: "MINH", number: 4, rating: 87 },
    { x: 260, y: 580, role: "DF", name: "NAM", number: 5, rating: 86 },
    { x: 520, y: 120, role: "MF", name: "HUNG", number: 8, rating: 90 },
    { x: 574, y: 350, role: "FW", name: "TONY", number: 10, rating: 92 },
    { x: 520, y: 580, role: "FW", name: "PHUC", number: 11, rating: 89 }
  ]),
  away: Object.freeze([
    { x: 360, y: 80, role: "DF", name: "NOVA", number: 1, rating: 87 },
    { x: 390, y: 80, role: "DF", name: "VEX", number: 3, rating: 88 },
    { x: 420, y: 80, role: "DF", name: "ZERO", number: 5, rating: 87 },
    { x: 360, y: 620, role: "MF", name: "ECHO", number: 8, rating: 91 },
    { x: 390, y: 620, role: "FW", name: "BLAZE", number: 9, rating: 92 },
    { x: 420, y: 620, role: "FW", name: "RUSH", number: 11, rating: 90 }
  ])
});

export function findPlayer(snapshot, id) {
  return snapshot.players.find((player) => player.id === id) ?? null;
}
