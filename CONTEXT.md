# Sumo Random

A local two-player, one-button-each sumo game. Two ragdoll Wrestlers try to shove each other out of a Ring.

## People and pieces

**Player**:
A human at the keyboard. Player 1 uses W; Player 2 uses the Up arrow.
_Avoid_: User, controller

**Wrestler**:
The character one Player controls. Player 1's Wrestler wears a red mawashi; Player 2's wears a blue one.
_Avoid_: Character, fighter, sumo (as a noun for the character)

**Ring**:
The raised platform the Wrestlers fight on.
_Avoid_: Dohyo, arena, stage

**Floor**:
The ground under and around the raised Ring, where Wrestlers land after falling off.
_Avoid_: Ground, outside

**Ring-out Line**:
A level one head-height below the Ring's top surface, marked by a black band on the Ring's side. It decides Ring-outs.
_Avoid_: Threshold, boundary

**Start Mark**:
The fixed spot on the Ring where a Wrestler begins each Bout.
_Avoid_: Spawn, start line

## Actions

**Charge**:
A Wrestler's belly-first lunge along its current lean. One press of its Player's key gives one Charge, available whenever any part of the Wrestler touches the Ring or the Floor. It is the Wrestler's only action: the same Charge, well timed, is also how a fallen Wrestler gets back up.
_Avoid_: Move, jump, thrust, attack, squirm

## Flow

**Ready Check**:
The step before a Match where each Player presses their key to show they're ready. The Match begins once both have pressed.
_Avoid_: Lobby, countdown

**Plop-in**:
The moment at the start of every Bout when both Wrestlers are dropped back onto their Start Marks.
_Avoid_: Reset, respawn, teleport

## Scoring

**Ring-out**:
A Wrestler's whole body being below the Ring-out Line, whether or not the other Wrestler touched it. Falling over on top of the Ring, or hanging off its edge with any part still above the line, is not a Ring-out.
_Avoid_: Knockout, fall, elimination

**Bout**:
One exchange, from Plop-in to the first Ring-out. If both Ring-outs happen at the exact same moment, the Bout is replayed with no Point.
_Avoid_: Round, game

**Point**:
What the other Player earns when a Wrestler has a Ring-out.
_Avoid_: Score (as a noun for a single unit)

**Match**:
A series of Bouts that ends when one Player reaches 5 Points.
_Avoid_: Game, set

**Victory Dance**:
The winning Wrestler's on-the-spot celebration at the end of a Match: arms pumping, a little dance. It happens wherever the winner stands, even on the Floor.
_Avoid_: Celebration, win animation
