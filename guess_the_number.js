#!/usr/bin/env node
// Guess the Number - a simple terminal game with difficulty levels

const readline = require("readline");

const DIFFICULTIES = {
  easy: { low: 1, high: 50, maxAttempts: 10 },
  medium: { low: 1, high: 100, maxAttempts: 7 },
  hard: { low: 1, high: 200, maxAttempts: 5 },
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function displayHeader() {
  console.log("=".repeat(40));
  console.log("   GUESS THE NUMBER");
  console.log("=".repeat(40));
}

function chooseDifficulty() {
  return new Promise(async (resolve) => {
    console.log("\nSelect difficulty:");
    const keys = Object.keys(DIFFICULTIES);
    keys.forEach((key, i) => {
      const d = DIFFICULTIES[key];
      console.log(
        `  ${i + 1}. ${key.charAt(0).toUpperCase() + key.slice(1)} (${d.low}-${d.high}, ${d.maxAttempts} attempts)`
      );
    });

    while (true) {
      const choice = (await question("\nEnter choice (1-3): ")).trim();
      if (["1", "2", "3"].includes(choice)) {
        const name = keys[parseInt(choice) - 1];
        resolve(DIFFICULTIES[name]);
      }
      console.log("Invalid choice. Please enter 1, 2, or 3.");
    }
  });
}

function playGame(low, high, maxAttempts) {
  return new Promise(async (resolve) => {
    const secret = Math.floor(Math.random() * (high - low + 1)) + low;
    let attempts = 0;

    console.log(`\nI'm thinking of a number between ${low} and ${high}.`);
    console.log(`You have ${maxAttempts} attempts. Good luck!\n`);

    while (attempts < maxAttempts) {
      const guessInput = (await question(`Attempt ${attempts + 1}/${maxAttempts} - Enter your guess: `)).trim();

      const guess = parseInt(guessInput, 10);
      if (isNaN(guess) || guessInput === "" || guessInput !== String(guess)) {
        console.log("Please enter a valid whole number.\n");
        continue;
      }

      attempts += 1;

      if (guess < low || guess > high) {
        console.log(`That's outside the range ${low}-${high}. Try again.\n`);
        continue;
      }

      if (guess === secret) {
        console.log(`\nCorrect! You found the number ${secret} in ${attempts} attempt(s)!`);
        resolve(attempts);
        return;
      } else if (guess < secret) {
        console.log("Too low.\n");
      } else {
        console.log("Too high.\n");
      }
    }

    console.log(`\nGame over! The number was ${secret}.`);
    resolve(null);
  });
}

async function main() {
  displayHeader();

  let bestScore = null;
  let gamesPlayed = 0;

  while (true) {
    const { low, high, maxAttempts } = await chooseDifficulty();
    const result = await playGame(low, high, maxAttempts);
    gamesPlayed += 1;

    if (result !== null) {
      if (bestScore === null || result < bestScore) {
        bestScore = result;
      }
      console.log(`Best score: ${bestScore} attempt(s)`);
    }

    console.log(`\nGames played: ${gamesPlayed}`);
    const again = (await question("Play again? (y/n): ")).trim().toLowerCase();
    if (again !== "y" && again !== "yes") {
      break;
    }
  }

  console.log(`\nThanks for playing! You played ${gamesPlayed} game(s).`);
  if (bestScore !== null) {
    console.log(`Your best score: ${bestScore} attempt(s)`);
  }
  console.log("Goodbye!");

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  rl.close();
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\n\nGame interrupted. Goodbye!");
  rl.close();
  process.exit(0);
});
