// The screenshot scenes behind ?shot=cover|detection|loot|escape. Each one asks the world to set
// up that moment of a real heist - the player creeping through a camera's cone, a guard noticing
// them, the diamond just lifted off its plinth, the run for the exit with the alarm shrieking - so
// the frame shows the real rules rather than a hand-placed drawing. The same seed always gives the
// same frame, and the best time shown is 0 because a staged scene has not been played or timed.
//
// The screen comes back from the staged state itself: the three in-heist scenes are played on the
// play screen, and the escape is shown on the game-over screen, since that is the panel the player
// sees at the moment the getaway ends.

/**
 * Set `world` to the named scene (cover, detection, loot or escape; any other name is treated as
 * cover) and return the screen to draw over it and the best time to show.
 */
export function stageShot(name, world) {
  world.stage(name);
  return { screen: world.state.screen, best: 0 };
}
