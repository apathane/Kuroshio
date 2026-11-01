#!/usr/bin/env python3
"""Guess the Number - a simple terminal game with difficulty levels."""

import random
import sys


DIFFICULTIES = {
    "easy": (1, 50, 10),
    "medium": (1, 100, 7),
    "hard": (1, 200, 5),
}


def display_header():
    print("=" * 40)
    print("   GUESS THE NUMBER")
    print("=" * 40)


def choose_difficulty():
    print("\nSelect difficulty:")
    for i, (name, (low, high, max_attempts)) in enumerate(DIFFICULTIES.items(), 1):
        print(f"  {i}. {name.capitalize()} ({low}-{high}, {max_attempts} attempts)")

    while True:
        choice = input("\nEnter choice (1-3): ").strip()
        if choice in ("1", "2", "3"):
            name = list(DIFFICULTIES.keys())[int(choice) - 1]
            return DIFFICULTIES[name]
        print("Invalid choice. Please enter 1, 2, or 3.")


def play_game(low, high, max_attempts):
    secret = random.randint(low, high)
    attempts = 0

    print(f"\nI'm thinking of a number between {low} and {high}.")
    print(f"You have {max_attempts} attempts. Good luck!\n")

    while attempts < max_attempts:
        remaining = max_attempts - attempts
        guess_input = input(f"Attempt {attempts + 1}/{max_attempts} - Enter your guess: ").strip()

        try:
            guess = int(guess_input)
        except ValueError:
            print("Please enter a valid whole number.\n")
            continue

        attempts += 1

        if guess < low or guess > high:
            print(f"That's outside the range {low}-{high}. Try again.\n")
            continue

        if guess == secret:
            print(f"\nCorrect! You found the number {secret} in {attempts} attempt(s)!")
            return attempts
        elif guess < secret:
            print("Too low.\n")
        else:
            print("Too high.\n")

    print(f"\nGame over! The number was {secret}.")
    return None


def main():
    display_header()

    best_score = None
    games_played = 0

    while True:
        low, high, max_attempts = choose_difficulty()
        result = play_game(low, high, max_attempts)
        games_played += 1

        if result is not None:
            if best_score is None or result < best_score:
                best_score = result
            print(f"Best score: {best_score} attempt(s)")

        print(f"\nGames played: {games_played}")
        again = input("Play again? (y/n): ").strip().lower()
        if again not in ("y", "yes"):
            break

    print(f"\nThanks for playing! You played {games_played} game(s).")
    if best_score is not None:
        print(f"Your best score: {best_score} attempt(s)")
    print("Goodbye!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nGame interrupted. Goodbye!")
        sys.exit(0)
