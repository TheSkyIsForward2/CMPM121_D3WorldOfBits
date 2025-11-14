# Game Design Vision

The player will be able to take, combine, and store tokens using caches found on the map and the singular token allowed in their inventory. The player will only be able to interact with caches that are nearby.

## Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?
Key gameplay challenge: Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

### Steps

- [x] copy main.ts to reference.ts for future reference
- [x] delete everything in main.ts
- [x] put a basic leaflet map on the screen
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map
- [x] add token to caches
- [x] add combine or take token on click event to caches
- [x] add inventory token slot -> kind of done, needs better functionality
- [x] add detection of token value requirement
- [] create player-cache hopping interaction -> for B?
- [x] play with range and probability
- [x] add visual to caches that displays number
- [x] update visual to caches upon buttons
- [x] distance from player code
- [] make rectangles different colors depending on token -> maybe later

## D3.b: Globe-spanning Gameplay - Player Movement and Win Condition

Key technical challenge: Can you improve on your system to simulate map movement?

[x] buttons that move player
[x] create helper function to convert between grid coordinates and LatLong
[] generate cells using moveend when map is moved - probably as function
[] circle moves with player
[] cells are memoryless
[] update win condition to 32 or higher?
