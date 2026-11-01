#!/usr/bin/env node
// Neon Cipher - A progression-driven terminal hacking game
// Crack codes, level up, earn credits, buy power-ups, unlock achievements.
// Progress persists between sessions in savegame.json

const readline = require("readline");
const fs = require("fs");
const path = require("path");

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  clear: "\x1b[2J\x1b[3J\x1b[H",
  blink: "\x1b[5m",
};

const SAVE_FILE = path.join(process.cwd(), "savegame.json");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function q(prompt) {
  return new Promise((resolve) => rl.question(prompt, (ans) => resolve(ans.trim())));
}

function pause() {
  return q(`${C.dim}Press Enter to continue...${C.reset} `);
}

function clear() {
  process.stdout.write(C.clear);
}

function color(str, c) {
  return `${c}${str}${C.reset}`;
}

function center(str, width = 60) {
  if (str.length >= width) return str;
  const pad = Math.floor((width - str.length) / 2);
  return " ".repeat(pad) + str;
}

// ---------------- Data ----------------

const DIFFICULTIES = [
  { id: "rookie", name: "Rookie", low: 1, high: 30, maxAttempts: 8, baseXp: 20, baseCredits: 15, unlockLevel: 1, color: C.green },
  { id: "agent", name: "Field Agent", low: 1, high: 60, maxAttempts: 7, baseXp: 45, baseCredits: 35, unlockLevel: 3, color: C.cyan },
  { id: "operative", name: "Operative", low: 1, high: 120, maxAttempts: 6, baseXp: 90, baseCredits: 70, unlockLevel: 6, color: C.blue },
  { id: "ghost", name: "Ghost", low: 1, high: 250, maxAttempts: 5, baseXp: 180, baseCredits: 140, unlockLevel: 10, color: C.magenta },
  { id: "zero", name: "Zero Day", low: 1, high: 500, maxAttempts: 4, baseXp: 350, baseCredits: 280, unlockLevel: 15, color: C.red },
];

const POWERUPS = [
  { id: "scan", name: "Range Scan", cost: 25, desc: "Narrows the possible range by 40% before you guess.", emoji: "🔍" },
  { id: "life", name: "Extra Life", cost: 50, desc: "One wrong guess doesn't count against your attempts.", emoji: "❤️" },
  { id: "peek", name: "Digit Peek", cost: 75, desc: "Reveals the first digit of the secret number.", emoji: "👁️" },
  { id: "solve", name: "Auto Solve", cost: 200, desc: "Instantly cracks the code (no XP/credits reward).", emoji: "⚡" },
];

const ACHIEVEMENTS = [
  { id: "first_crack", name: "First Crack", desc: "Win your first game.", xp: 50, credits: 10 },
  { id: "streak_3", name: "Hot Streak", desc: "Win 3 games in a row.", xp: 100, credits: 25 },
  { id: "streak_10", name: "Unstoppable", desc: "Win 10 games in a row.", xp: 300, credits: 75 },
  { id: "perfect", name: "Perfect Crack", desc: "Guess correctly on the first try.", xp: 200, credits: 50 },
  { id: "level_10", name: "Master Hacker", desc: "Reach level 10.", xp: 500, credits: 100 },
  { id: "level_20", name: "Architect", desc: "Reach level 20.", xp: 1000, credits: 250 },
  { id: "rich", name: "Encrypted Wealth", desc: "Accumulate 1000 total credits earned.", xp: 250, credits: 100 },
  { id: "collector", name: "Tool Collector", desc: "Buy every power-up.", xp: 300, credits: 100 },
];

const DEFAULT_PLAYER = {
  name: "Runner",
  level: 1,
  xp: 0,
  xpToNext: 100,
  credits: 0,
  totalCreditsEarned: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  streak: 0,
  bestStreak: 0,
  totalAttempts: 0,
  firstTryWins: 0,
  ownedPowerups: { scan: 0, life: 0, peek: 0, solve: 0 },
  purchasedPowerups: [],
  unlockedAchievements: [],
  highScores: {},
  lastDifficulty: null,
};

// ---------------- Save system ----------------

function loadPlayer() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      const raw = fs.readFileSync(SAVE_FILE, "utf8");
      const saved = JSON.parse(raw);
      return { ...DEFAULT_PLAYER, ...saved };
    }
  } catch (e) {
    // ignore corrupt saves
  }
  return { ...DEFAULT_PLAYER };
}

function savePlayer(p) {
  try {
    fs.writeFileSync(SAVE_FILE, JSON.stringify(p, null, 2));
  } catch (e) {
    console.log(`${C.red}Failed to save progress.${C.reset}`);
  }
}

// ---------------- XP / Leveling ----------------

function addXp(p, amount) {
  p.xp += amount;
  let leveled = false;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level += 1;
    p.xpToNext = Math.floor(100 * Math.pow(1.5, p.level - 1));
    leveled = true;
  }
  return leveled;
}

function unlockablesForLevel(level) {
  const diffs = DIFFICULTIES.filter((d) => d.unlockLevel <= level);
  const pow = POWERUPS.filter((pu) => !purchased(p, pu.id));
  return { diffs, pow };
}

function purchased(p, id) {
  return p.purchasedPowerups.includes(id);
}

// ---------------- Achievements ----------------

function checkAchievements(p, ctx) {
  const newly = [];
  const already = new Set(p.unlockedAchievements);

  const tests = [
    { id: "first_crack", cond: p.gamesWon >= 1 },
    { id: "streak_3", cond: p.streak >= 3 },
    { id: "streak_10", cond: p.streak >= 10 },
    { id: "perfect", cond: ctx.firstTry },
    { id: "level_10", cond: p.level >= 10 },
    { id: "level_20", cond: p.level >= 20 },
    { id: "rich", cond: p.totalCreditsEarned >= 1000 },
    { id: "collector", cond: p.purchasedPowerups.length >= POWERUPS.length },
  ];

  for (const t of tests) {
    if (t.cond && !already.has(t.id)) {
      p.unlockedAchievements.push(t.id);
      p.xp += t.xp;
      p.credits += t.credits;
      newly.push(ACHIEVEMENTS.find((a) => a.id === t.id));
    }
  }
  return newly;
}

// ---------------- UI helpers ----------------

function drawBar(current, max, width = 24) {
  const filled = Math.floor((current / max) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const pct = Math.floor((current / max) * 100);
  return `${C.cyan}[${bar}]${C.reset} ${pct}%`;
}

function titleScreen() {
  console.log(C.clear);
  console.log(C.bold + C.cyan);
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                                                            ║");
  console.log("║   ███╗   ███╗███████╗ ██████╗██╗   ██╗    ███████╗██╗  ██╗ ║");
  console.log("║   ████╗ ████║██╔════╝██╔════╝╚██╗ ██╔╝    ██╔════╝╚██╗██╔╝ ║");
  console.log("║   ██╔████╔██║█████╗  ██║      ╚████╔╝     █████╗   ╚███╔╝  ║");
  console.log("║   ██║╚██╔╝██║██╔══╝  ██║       ╚██╔╝      ██╔══╝   ██╔██╗  ║");
  console.log("║   ██║ ╚═╝ ██║███████╗╚██████╗   ██║       ███████╗██╔╝ ██╗ ║");
  console.log("║   ╚═╝     ╚═╝╚══════╝╚══════╝   ╚═╝       ╚══════╝╚═╝  ╚═╝ ║");
  console.log("║                                                            ║");
  console.log("║              NEON CIPHER  -  TERMINAL HACKER SIM           ║");
  console.log("║                                                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(C.reset);
}

function statusLine(p) {
  const next = p.xpToNext - p.xp;
  console.log(
    `${C.bold}RUNNER${C.reset} ${C.white}${p.name}${C.reset}  |  ${C.yellow}Lv.${p.level}${C.reset}  |  XP ${drawBar(p.xp, p.xpToNext)}  |  ${C.green}✦${p.credits} credits${C.reset}`
  );
  console.log(`${C.dim}XP to next level: ${next}   Games: ${p.gamesPlayed}  Wins: ${p.gamesWon}  Streak: ${p.streak}${C.reset}\n`);
}

// ---------------- Core game: Classic ----------------

function playClassic(p) {
  clear();
  titleScreen();
  statusLine(p);

  const avail = DIFFICULTIES.filter((d) => d.unlockLevel <= p.level);
  console.log(`${C.bold}SELECT CIPHER TIER${C.reset}`);
  avail.forEach((d, i) => {
    const locked = d.unlockLevel > p.level ? `  ${C.red}[LOCKED - Lv.${d.unlockLevel}]${C.reset}` : "";
    console.log(
      `  ${i + 1}. ${d.color}${d.name}${C.reset}  ${C.dim}(${d.low}-${d.high}, ${d.maxAttempts} attempts)${C.reset}${locked}`
    );
  });
  console.log(`  0. ${C.dim}Back${C.reset}`);

  const sel = q("\nChoose tier: ");
  return sel.then((choice) => {
    const idx = parseInt(choice, 10);
    if (idx === 0) return null;
    if (!idx || idx < 1 || idx > avail.length) {
      console.log(`${C.red}Invalid choice.${C.reset}`);
      return pause().then(() => playClassic(p));
    }
    const diff = avail[idx - 1];
    if (diff.unlockLevel > p.level) {
      console.log(`${C.red}Locked! Reach level ${diff.unlockLevel} to unlock ${diff.name}.${C.reset}`);
      return pause().then(() => playClassic(p));
    }
    return runRound(p, diff);
  });
}

function runRound(p, diff) {
  clear();
  titleScreen();
  statusLine(p);

  const secret = Math.floor(Math.random() * (diff.high - diff.low + 1)) + diff.low;
  let attempts = 0;
  let maxAttempts = diff.maxAttempts;
  let extraLifeUsed = false;
  let rangeNarrowed = false;
  let digitRevealed = null;
  let firstGuess = true;

  // Power-up selection
  const owned = p.ownedPowerups;
  const usable = POWERUPS.filter((pu) => owned[pu.id] > 0 || purchased(p, pu.id));
  console.log(`${C.bold}CIPHER TIER: ${diff.color}${diff.name}${C.reset}  ${C.dim}Range ${diff.low}-${diff.high} • ${maxAttempts} attempts${C.reset}`);
  if (usable.length) {
    console.log(`${C.yellow}POWER-UPS AVAILABLE:${C.reset}`);
    usable.forEach((pu, i) => {
      console.log(`  ${i + 1}. ${pu.emoji} ${pu.name} (x${owned[pu.id] > 0 ? owned[pu.id] : "∞"}) - ${pu.desc}`);
    });
    console.log(`  0. ${C.dim}None${C.reset}`);
  } else {
    console.log(`${C.dim}No power-ups. Buy some at the Shop!${C.reset}`);
  }

  const choosePow = q("\nSelect power-up (or 0): ");
  return choosePow.then((powChoice) => {
    const powIdx = parseInt(powChoice, 10);
    let selectedPow = null;
    if (powIdx > 0 && powIdx <= usable.length) {
      selectedPow = usable[powIdx - 1];
      if (selectedPow.id === "solve") {
        console.log(`${C.magenta}Auto-solving...${C.reset}`);
        console.log(`${C.green}The code was ${secret}.${C.reset}`);
        console.log(`${C.yellow}No reward for using Auto Solve.${C.reset}`);
        p.gamesPlayed += 1;
        p.streak = 0;
        savePlayer(p);
        return pause().then(() => ({ p }));
      }
      if (owned[selectedPow.id] > 0) {
        owned[selectedPow.id] -= 1;
      } else if (purchased(p, selectedPow.id)) {
        // infinite use purchased power-up
      } else {
        console.log(`${C.red}You don't own this power-up.${C.reset}`);
      }
    }

    if (selectedPow) {
      if (selectedPow.id === "scan") {
        const span = diff.high - diff.low;
        const pad = Math.floor(span * 0.3);
        const newLow = Math.max(diff.low, secret - pad);
        const newHigh = Math.min(diff.high, secret + pad);
        console.log(`${C.blue}🔍 Range Scan: The code is between ${newLow} and ${newHigh}.${C.reset}`);
        rangeNarrowed = true;
      } else if (selectedPow.id === "peek") {
        digitRevealed = Math.floor(secret / 10) % 10;
        if (secret < 10) digitRevealed = secret;
        console.log(`${C.blue}👁️  Digit Peek: A digit in the code is ${digitRevealed}.${C.reset}`);
      } else if (selectedPow.id === "life") {
        extraLifeUsed = true;
        console.log(`${C.red}❤️  Extra Life active: your next wrong guess is free.${C.reset}`);
      }
    }

    console.log(`\n${C.bold}CRACKING ${diff.name.toUpperCase()}...${C.reset}\n`);

    const loop = () => {
      if (attempts >= maxAttempts) {
        return endRound(p, diff, false, secret, attempts, firstGuess);
      }
      const remaining = maxAttempts - attempts;
      const hint = rangeNarrowed ? "" : ` ${C.dim}(${diff.low}-${diff.high})${C.reset}`;
      return q(`Attempt ${attempts + 1}/${maxAttempts}${hint} - Enter guess: `).then((input) => {
        const guess = parseInt(input, 10);
        if (isNaN(guess) || input === "" || input !== String(guess)) {
          console.log(`${C.red}Enter a valid whole number.${C.reset}\n`);
          return loop();
        }
        attempts += 1;
        p.totalAttempts += 1;
        firstGuess = false;

        if (guess < diff.low || guess > diff.high) {
          console.log(`${C.red}Outside range.${C.reset}\n`);
          return loop();
        }

        if (guess === secret) {
          return endRound(p, diff, true, secret, attempts, attempts === 1);
        }

        if (guess < secret) {
          console.log(`${C.blue}▲ TOO LOW${C.reset}\n`);
        } else {
          console.log(`${C.red}▼ TOO HIGH${C.reset}\n`);
        }

        if (extraLifeUsed && attempts < maxAttempts) {
          extraLifeUsed = false;
          console.log(`${C.yellow}❤️  Extra Life saved you from that wrong guess.${C.reset}\n`);
          return loop();
        }

        return loop();
      });
    };

    return loop();
  });
}

function endRound(p, diff, won, secret, attempts, firstTry) {
  clear();
  titleScreen();
  statusLine(p);

  if (won) {
    const baseXp = diff.baseXp;
    const baseCredits = diff.baseCredits;
    const streakBonus = Math.floor(p.streak * 0.5) + 1;
    const xpEarned = baseXp + Math.floor((diff.maxAttempts - attempts + 1) * 5) + streakBonus * 5;
    const creditsEarned = baseCredits + Math.floor((diff.maxAttempts - attempts + 1) * 3) + streakBonus * 3;

    p.gamesPlayed += 1;
    p.gamesWon += 1;
    p.streak += 1;
    if (p.streak > p.bestStreak) p.bestStreak = p.streak;
    if (firstTry) p.firstTryWins += 1;
    p.totalCreditsEarned += creditsEarned;
    p.credits += creditsEarned;

    const leveled = addXp(p, xpEarned);

    const ctx = { firstTry };
    const newly = checkAchievements(p, ctx);

    console.log(`${C.green}╔═══════════════════════════════════════╗${C.reset}`);
    console.log(`${C.green}║  CIPHER CRACKED! CODE WAS ${secret}${C.reset}               ║`);
    console.log(`${C.green}╚════════════════════════════════════════╝${C.reset}\n`);
    console.log(`  ${C.green}✓${C.reset} Attempts: ${attempts}/${diff.maxAttempts}`);
    console.log(`  ${C.yellow}+${xpEarned} XP   +${creditsEarned} credits   Streak x${streakBonus}${C.reset}`);
    console.log(`  ${C.green}Streak: ${p.streak}${C.reset}`);
    if (leveled) {
      console.log(`\n  ${C.bold}${C.magenta}★ LEVEL UP! You are now level ${p.level}! ★${C.reset}`);
      console.log(`  ${C.dim}XP to next: ${p.xpToNext - p.xp}${C.reset}`);
    }
    if (newly.length) {
      console.log(`\n  ${C.bold}${C.yellow}ACHIEVEMENT UNLOCKED:${C.reset}`);
      newly.forEach((a) => {
        console.log(`   🏆 ${a.name} - ${a.desc} (+${a.xp} XP, +${a.credits} ✦)`);
      });
    }
  } else {
    p.gamesPlayed += 1;
    p.streak = 0;
    console.log(`${C.red}╔════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.red}║  CONNECTION LOST. CODE WAS ${secret} ${" ".repeat(Math.max(0, 12 - String(secret).length))}║${C.reset}`);
    console.log(`${C.red}╚════════════════════════════════════════╝${C.reset}\n`);
    console.log(`  ${C.yellow}Streak broken. Best streak: ${p.bestStreak}${C.reset}`);
  }

  savePlayer(p);
  console.log(`\n${C.dim}High score for ${diff.name}: ${p.highScores[diff.id] || "none"} attempts${C.reset}`);
  if (won && (!p.highScores[diff.id] || attempts < p.highScores[diff.id])) {
    p.highScores[diff.id] = attempts;
    savePlayer(p);
    console.log(`  ${C.green}NEW BEST!${C.reset}`);
  }

  return pause().then(() => ({ p }));
}

// ---------------- Blitz mode (timed) ----------------

function playBlitz(p) {
  clear();
  titleScreen();
  statusLine(p);
  console.log(`${C.bold}${C.red}BLITZ MODE${C.reset} - 60 seconds. Crack as many codes as you can.\n`);
  const diff = DIFFICULTIES[1]; // agent tier fixed
  console.log(`Tier: ${diff.color}${diff.name}${C.reset} (${diff.low}-${diff.high})`);
  console.log("Each correct crack adds +5 seconds. Wrong guess = -2 seconds.\n");

  return pause().then(() => {
    let timeLeft = 60;
    let score = 0;
    const start = Date.now();

    const loop = () => {
      const now = Date.now();
      timeLeft = 60 - Math.floor((now - start) / 1000);
      if (timeLeft <= 0) {
        clear();
        titleScreen();
        statusLine(p);
        console.log(`${C.red}TIME'S UP!${C.reset}\n`);
        console.log(`  Final score: ${score} cracks`);
        const prev = p.highScores.blitz || 0;
        if (score > prev) {
          p.highScores.blitz = score;
          console.log(`  ${C.green}NEW BLITZ RECORD!${C.reset}`);
        }
        p.gamesPlayed += 1;
        savePlayer(p);
        return pause().then(() => ({ p }));
      }

      const secret = Math.floor(Math.random() * (diff.high - diff.low + 1)) + diff.low;
      console.log(`\n${C.bold}Time: ${timeLeft}s  |  Score: ${score}${C.reset}`);
      console.log(`Guess a number ${diff.low}-${diff.high}:`);

      return q("> ").then((input) => {
        const guess = parseInt(input, 10);
        if (isNaN(guess)) {
          console.log(`${C.red}Invalid.${C.reset}`);
          return loop();
        }
        if (guess === secret) {
          score += 1;
          timeLeft += 5;
          console.log(`${C.green}CRACKED! +5s${C.reset}`);
        } else {
          timeLeft = Math.max(0, timeLeft - 2);
          console.log(`${C.red}Wrong (was ${secret}). -2s${C.reset}`);
        }
        return loop();
      });
    };

    return loop();
  });
}

// ---------------- Marathon mode ----------------

function playMarathon(p) {
  clear();
  titleScreen();
  statusLine(p);
  console.log(`${C.bold}${C.magenta}MARATHON MODE${C.reset} - Endless. Difficulty rises each round.\n`);
  console.log("Survive as long as you can. One wrong guess ends the run.\n");

  return pause().then(() => {
    let round = 1;
    let streak = 0;

    const loop = () => {
      const tierIndex = Math.min(round - 1, DIFFICULTIES.length - 1);
      const diff = DIFFICULTIES[tierIndex];
      const secret = Math.floor(Math.random() * (diff.high - diff.low + 1)) + diff.low;
      let attempts = 0;
      const maxAttempts = Math.max(2, diff.maxAttempts - Math.floor(round / 3));

      clear();
      titleScreen();
      statusLine(p);
      console.log(`${C.bold}MARATHON - ROUND ${round}  ${C.dim}Tier: ${diff.name}${C.reset}`);
      console.log(`Guess ${diff.low}-${diff.high} | ${maxAttempts} attempts | Streak: ${streak}\n`);

      const inner = () => {
        if (attempts >= maxAttempts) {
          return finishMarathon(p, round, streak);
        }
        return q(`Attempt ${attempts + 1}/${maxAttempts}: `).then((input) => {
          const guess = parseInt(input, 10);
          if (isNaN(guess)) {
            console.log(`${C.red}Invalid.${C.reset}`);
            return inner();
          }
          attempts += 1;
          if (guess === secret) {
            streak += 1;
            round += 1;
            console.log(`${C.green}Cracked! Advancing...${C.reset}`);
            return pause().then(() => loop());
          }
          console.log(`${C.red}Wrong. Code was ${secret}. Run over.${C.reset}`);
          return finishMarathon(p, round, streak);
        });
      };

      return inner();
    };

    return loop();
  });
}

function finishMarathon(p, round, streak) {
  clear();
  titleScreen();
  statusLine(p);
  const xpEarned = round * 10;
  const credsEarned = round * 5;
  p.xp += xpEarned;
  p.credits += credsEarned;
  p.totalCreditsEarned += credsEarned;
  p.gamesPlayed += 1;
  if (streak > p.bestStreak) p.bestStreak = streak;
  let lvled = false;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level += 1;
    p.xpToNext = Math.floor(100 * Math.pow(1.5, p.level - 1));
    lvled = true;
  }

  console.log(`${C.bold}MARATHON COMPLETE${C.reset}`);
  console.log(`  Rounds survived: ${round - 1}`);
  console.log(`  Longest streak this run: ${streak}`);
  console.log(`  ${C.yellow}+${xpEarned} XP  +${credsEarned} credits${C.reset}`);
  if (lvled) console.log(`  ${C.magenta}★ LEVEL UP! Now level ${p.level}!${C.reset}`);
  savePlayer(p);
  return pause().then(() => ({ p }));
}

// ---------------- Shop ----------------

function openShop(p) {
  clear();
  titleScreen();
  statusLine(p);
  console.log(`${C.bold}${C.yellow}BLACK MARKET SHOP${C.reset}`);
  console.log(`  Your credits: ${C.green}${p.credits}${C.reset}\n`);

  POWERUPS.forEach((pu, i) => {
    const own = p.ownedPowerups[pu.id] || 0;
    const already = purchased(p, pu.id);
    const status = already
      ? `${C.green}[OWNED - UNLIMITED]${C.reset}`
      : own > 0
      ? `${C.dim}[x${own}]${C.reset}`
      : `${C.red}[LOCKED]${C.reset}`;
    const canBuy = !already && p.credits >= pu.cost;
    console.log(
      `  ${i + 1}. ${pu.emoji} ${pu.name}  ${C.dim}${pu.cost} ✦${C.reset}  ${status}`
    );
    console.log(`      ${C.dim}${pu.desc}${C.reset}`);
    if (!already && !canBuy && own === 0) {
      console.log(`      ${C.red}Not enough credits.${C.reset}`);
    }
  });
  console.log(`  0. ${C.dim}Back${C.reset}\n`);

  return q("Buy which item? ").then((choice) => {
    const idx = parseInt(choice, 10);
    if (idx === 0) return { p };
    if (!idx || idx < 1 || idx > POWERUPS.length) {
      console.log(`${C.red}Invalid.${C.reset}`);
      return pause().then(() => openShop(p));
    }
    const pu = POWERUPS[idx - 1];
    if (purchased(p, pu.id)) {
      console.log(`${C.yellow}Already owned (unlimited).${C.reset}`);
      return pause().then(() => openShop(p));
    }
    if (p.credits < pu.cost) {
      console.log(`${C.red}Not enough credits.${C.reset}`);
      return pause().then(() => openShop(p));
    }
    p.credits -= pu.cost;
    p.purchasedPowerups.push(pu.id);
    p.ownedPowerups[pu.id] = (p.ownedPowerups[pu.id] || 0) + 1;
    savePlayer(p);
    console.log(`${C.green}Purchased ${pu.name}!${C.reset}`);
    return pause().then(() => openShop(p));
  });
}

// ---------------- Achievements screen ----------------

function showAchievements(p) {
  clear();
  titleScreen();
  statusLine(p);
  console.log(`${C.bold}${C.yellow}ACHIEVEMENTS${C.reset}\n`);
  const unlocked = new Set(p.unlockedAchievements);
  ACHIEVEMENTS.forEach((a) => {
    const done = unlocked.has(a.id);
    console.log(
      `  ${done ? C.green + "✔" : C.gray + "○"} ${a.name}  ${C.dim}(${a.desc})${C.reset}`
    );
    if (done) {
      console.log(`      ${C.green}+${a.xp} XP  +${a.credits} ✦${C.reset}`);
    }
  });
  console.log(`\n  ${C.dim}Unlocked: ${p.unlockedAchievements.length}/${ACHIEVEMENTS.length}${C.reset}`);
  return pause().then(() => ({ p }));
}

// ---------------- Stats ----------------

function showStats(p) {
  clear();
  titleScreen();
  statusLine(p);
  const winRate = p.gamesPlayed ? ((p.gamesWon / p.gamesPlayed) * 100).toFixed(1) : "0";
  console.log(`${C.bold}PLAYER STATS${C.reset}\n`);
  console.log(`  Games played : ${p.gamesPlayed}`);
  console.log(`  Games won    : ${p.gamesWon}`);
  console.log(`  Win rate     : ${winRate}%`);
  console.log(`  Best streak  : ${p.bestStreak}`);
  console.log(`  First-try wins: ${p.firstTryWins}`);
  console.log(`  Total attempts: ${p.totalAttempts}`);
  console.log(`  Credits (current): ${p.credits}`);
  console.log(`  Credits (lifetime): ${p.totalCreditsEarned}`);
  console.log(`  Level        : ${p.level}  (XP ${p.xp}/${p.xpToNext})\n`);
  console.log(`${C.bold}BEST SCORES (attempts, lower is better)${C.reset}`);
  DIFFICULTIES.forEach((d) => {
    const s = p.highScores[d.id];
    console.log(`  ${d.name}: ${s !== undefined ? s : C.dim + "-"+C.reset}`);
  });
  console.log(`  Blitz record : ${p.highScores.blitz || C.dim + "-"+C.reset}\n`);
  return pause().then(() => ({ p }));
}

// ---------------- Main menu ----------------

function mainMenu(p) {
  clear();
  titleScreen();
  statusLine(p);
  console.log(`${C.bold}MAIN MENU${C.reset}`);
  console.log(`  1. ${C.green}Play Classic${C.reset}   - Crack a cipher (progression)`);
  console.log(`  2. ${C.red}Blitz Mode${C.reset}     - 60-second sprint`);
  console.log(`  3. ${C.magenta}Marathon Mode${C.reset}  - Endless escalation`);
  console.log(`  4. ${C.yellow}Shop${C.reset}            - Buy power-ups`);
  console.log(`  5. ${C.cyan}Achievements${C.reset}    - View unlocked`);
  console.log(`  6. ${C.blue}Stats${C.reset}           - Player stats`);
  console.log(`  7. ${C.gray}Save & Exit${C.reset}`);
  console.log(`  0. ${C.dim}Exit without saving${C.reset}\n`);

  return q("Choose: ").then((choice) => {
    const c = parseInt(choice, 10);
    if (c === 1) return playClassic(p).then(({ p: pp }) => mainMenu(pp));
    if (c === 2) return playBlitz(p).then(({ p: pp }) => mainMenu(pp));
    if (c === 3) return playMarathon(p).then(({ p: pp }) => mainMenu(pp));
    if (c === 4) return openShop(p).then(({ p: pp }) => mainMenu(pp));
    if (c === 5) return showAchievements(p).then(({ p: pp }) => mainMenu(pp));
    if (c === 6) return showStats(p).then(({ p: pp }) => mainMenu(pp));
    if (c === 7) {
      savePlayer(p);
      console.log(`\n${C.green}Progress saved to ${SAVE_FILE}${C.reset}`);
      rl.close();
      process.exit(0);
    }
    if (c === 0) {
      console.log(`\n${C.dim}Exiting. Your progress was not saved this session.${C.reset}`);
      rl.close();
      process.exit(0);
    }
    console.log(`${C.red}Invalid choice.${C.reset}`);
    return pause().then(() => mainMenu(p));
  });
}

// ---------------- Boot ----------------

function boot() {
  clear();
  titleScreen();
  console.log(`${C.bold}${C.cyan}Welcome to Neon Cipher.${C.reset}`);
  console.log("You are a runner-for-hire cracking encrypted corporate ciphers.\n");
  console.log(`  ${C.yellow}Why play?${C.reset} Level up your hacker rank, earn credits,`);
  console.log(`        unlock harder tiers, collect power-ups, and complete`);
  console.log(`        every achievement. Your progress saves automatically.\n`);
  const nameInput = q("Enter your runner handle (or Enter for 'Runner'): ");
  return nameInput.then((name) => {
    const p = loadPlayer();
    if (name) p.name = name;
    console.log(`\n${C.green}Loading profile: ${p.name} (Level ${p.level})${C.reset}`);
    if (p.gamesPlayed > 0) {
      console.log(`${C.dim}Welcome back. Streak: ${p.streak}  Credits: ${p.credits}${C.reset}`);
    }
    return pause().then(() => mainMenu(p));
  });
}

boot().catch((err) => {
  console.error("Fatal error:", err);
  rl.close();
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log(`\n\n${C.yellow}Interrupted. Saving progress...${C.reset}`);
  try {
    const p = loadPlayer();
    savePlayer(p);
  } catch (e) {}
  rl.close();
  process.exit(0);
});
