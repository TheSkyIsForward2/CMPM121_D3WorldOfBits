// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
import luck from "./_luck.ts";

// Create basic UI elements
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.innerHTML = `<h1>D3: World of Bits</h1>`;
document.body.append(controlPanelDiv);

// storage keys
const LS_KEYS = {
  CELLS: "wob_cells_v1",
  HELD: "wob_heldToken_v1",
  PLAYER: "wob_player_v1",
  MODE: "wob_mode_v1",
};

const cellState = new Map<string, { tokenValue: number | null }>();

// convert Map to plain object for storage
function persistCells() {
  const obj: Record<string, number | null> = {};
  for (const [k, v] of cellState.entries()) {
    obj[k] = v.tokenValue;
  }
  localStorage.setItem(LS_KEYS.CELLS, JSON.stringify(obj));
}

// load the cells from the JSON
function loadCellsFromStorage() {
  const raw = localStorage.getItem(LS_KEYS.CELLS);
  if (!raw) return;
  try {
    const obj = JSON.parse(raw) as Record<string, number | null>;
    cellState.clear();
    for (const k of Object.keys(obj)) {
      cellState.set(k, { tokenValue: obj[k] });
    }
  } catch (e) {
    console.warn("Failed to parse stored cells:", e);
  }
}

// save the heldToken to JSON
function persistHeldToken() {
  localStorage.setItem(LS_KEYS.HELD, JSON.stringify(heldToken));
}

// load the heldToken to JSON
function loadHeldToken() {
  const raw = localStorage.getItem(LS_KEYS.HELD);
  if (!raw) return;
  try {
    heldToken = JSON.parse(raw) as number | null;
    statusPanelDiv.innerText = heldToken ? `${heldToken}` : " ";
  } catch (e) {
    console.warn("Failed to parse held token:", e);
  }
}

// i think you get the picture
function persistPlayerPosition() {
  const p = playerMarker.getLatLng();
  localStorage.setItem(LS_KEYS.PLAYER, JSON.stringify([p.lat, p.lng]));
}

function loadPlayerPosition() {
  const raw = localStorage.getItem(LS_KEYS.PLAYER);
  if (!raw) return false;
  try {
    const [lat, lng] = JSON.parse(raw) as [number, number];
    playerMarker.setLatLng(leaflet.latLng(lat, lng));
    map.setView(playerMarker.getLatLng());
    return true;
  } catch (e) {
    console.warn("Failed to parse player:", e);
    return false;
  }
}

const movementButtons = document.createElement("div");
movementButtons.id = "movementButtons";
document.body.append(movementButtons);

// text array for buttons
const direction = ["Up", "Down", "Left", "Right"];

direction.forEach((item) => {
  // add buttons
  const directionButton = document.createElement("button");
  directionButton.innerHTML = item;
  movementButtons.append(directionButton);

  directionButton.addEventListener("click", () => {
    // change movement
    const newPos = processMovement(playerMarker.getLatLng(), item);
    // store new movement
    applyPlayerMove(newPos);
  });
});

function applyPlayerMove(newLatLng: leaflet.LatLng | [number, number]) {
  // accept both LatLng object and [lat, lng] tuple
  let latlng: leaflet.LatLng;
  if (Array.isArray(newLatLng)) {
    latlng = leaflet.latLng(newLatLng[0], newLatLng[1]);
  } else {
    latlng = newLatLng;
  }

  // change latLng
  playerMarker.setLatLng(latlng);
  // clear layers first
  featureGroup.clearLayers();
  // update circle
  updateCircle();
  // generate cells
  cellGeneration();
  // update map view
  map.setView(playerMarker.getLatLng());
  // save to JSON
  persistPlayerPosition();
}

// movement UI
const movementToggle = document.createElement("div");
movementToggle.id = "movementToggle";
movementToggle.innerHTML = `
  <label> Movement: 
    <select id="movementModeSelect">
      <option value="buttons">Buttons</option>
      <option value="geo">Geolocation</option>
    </select>
  </label>
  <button id="newGameBtn">New Game</button>
`;
controlPanelDiv.append(movementToggle);

const modeSelect = movementToggle.querySelector<HTMLSelectElement>("#movementModeSelect")!;
const newGameBtn = movementToggle.querySelector<HTMLButtonElement>("#newGameBtn")!;

newGameBtn.addEventListener("click", () => {
  // confirm statement (cool tool btw)
  if (!confirm("Start a new game? This will reset saved progress.")) return;

  // clear stored data
  localStorage.removeItem(LS_KEYS.CELLS);
  localStorage.removeItem(LS_KEYS.HELD);
  localStorage.removeItem(LS_KEYS.PLAYER);

  // clear loaded data
  cellState.clear();
  heldToken = 2;
  statusPanelDiv.innerText = " ";
  // reset player to original position (will be updated to normal location when geolocation is used)
  applyPlayerMove(CLASSROOM_LATLNG);

  // refresh display
  featureGroup.clearLayers();
  updateCircle();
  cellGeneration();
});

const wrapDiv = document.createElement("div");
wrapDiv.id = "wrapDiv";
document.body.append(wrapDiv);

let heldToken: number | null = 2;

const inventoryDiv = document.createElement("div");
inventoryDiv.id = "inventory";
inventoryDiv.innerText = "Inventory:";
wrapDiv.append(inventoryDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
statusPanelDiv.innerText = `${heldToken}`;
inventoryDiv.append(statusPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
wrapDiv.append(mapDiv);

// Our classroom locationation
const CLASSROOM_LATLNG = leaflet.latLng(
  36.9979,
  -122.0570,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const RANGE = 20;
const CELL_SPAWN_PROBABILITY = 0.07;
const winCondition = 32;
const possibleStartingNum = [0, 2, 4, 8, 16];

// suggested fix to geolocation bug
let geoInitialized = false;

// map
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// feature group
const featureGroup = leaflet.featureGroup().addTo(map);

// background
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// player mark
const playerMarker = leaflet.marker(CLASSROOM_LATLNG).addTo(map);
playerMarker.bindTooltip("Current locationation");

// load persisted state (must run before cellGeneration so spawnCell can use cellState)
loadCellsFromStorage();
loadHeldToken();
if (!loadPlayerPosition()) {
  // fallback: classroom position already set by marker initialization
  map.setView(playerMarker.getLatLng());
}

// movement interface - facade
interface MovementController {
  start(): void; // start listening / watching
  stop(): void; // stop watching
  requestModeSwitch?(mode: "buttons" | "geo"): void; // optional helper
}

// class for button movement
class ButtonMovement implements MovementController {
  private onMove: (newPos: leaflet.LatLng | [number, number]) => void;
  private listeners: Array<() => void> = [];

  constructor(onMove: (l: leaflet.LatLng | [number, number]) => void) {
    this.onMove = onMove;
    // wire existing buttons
    this.wireButtons(); 
  }

  private wireButtons() {
    // find arrow buttons
    const btns = Array.from(controlPanelDiv.querySelectorAll("button"));
    // remove previously attached handlers
    btns.forEach((b) => {
      // clear old listeners
      b.replaceWith(b.cloneNode(true));
    });

    // re-query fresh buttons
    const freshBtns = Array.from(controlPanelDiv.querySelectorAll("button"));
    freshBtns.forEach((b) => {
      const text = b.innerHTML;
      b.addEventListener("click", () => {
        const newPos = processMovement(playerMarker.getLatLng(), text);
        this.onMove(newPos);
      });
    });
  }

  start() { enableMovementButtons()}
  stop() { disableMovementButtons() }
  requestModeSwitch?(mode: "buttons" | "geo") { if (mode === "buttons") this.wireButtons(); }
}

// geolocation code I needed ChatGPT to help with
class GeoMovement implements MovementController {
  private onMove: (newPos: leaflet.LatLng) => void;
  private watchId: number | null = null;
  constructor(onMove: (l: leaflet.LatLng) => void) {
    this.onMove = onMove;
  }

  start() {
    // if fail, do buttons instead
    if (!("geolocation" in navigator)) {
      console.warn("Geolocation not supported, falling back to buttons.");
      return;
    }
    // prefer high accuracy so small device movements translate into lat/lng changes
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePos(pos),
      (err) => console.warn("geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
    disableMovementButtons();
  }

  stop() {
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // function that snaps the player to the grid based on where their location is
  private handlePos(position: GeolocationPosition) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    // FIRST GPS FIX — move marker directly to true position
    if (!geoInitialized) {
      geoInitialized = true;
      this.onMove(leaflet.latLng(lat, lng));   // no snapping
      return;
    }

    const current = playerMarker.getLatLng();
    const dLat = lat - current.lat;
    const dLng = lng - current.lng;

    if (Math.abs(dLat) < TILE_DEGREES && Math.abs(dLng) < TILE_DEGREES) return;

    const stepsLat = Math.round((lat - current.lat) / TILE_DEGREES);
    const stepsLng = Math.round((lng - current.lng) / TILE_DEGREES);

    const newLat = current.lat + stepsLat * TILE_DEGREES;
    const newLng = current.lng + stepsLng * TILE_DEGREES;

    this.onMove(leaflet.latLng(newLat, newLng));
  }
}

function spawnCell(x: number, y: number) {
  // x and y by lat long
  x = gridToLatLong(x);
  y = gridToLatLong(y);

  const bounds = leaflet.latLngBounds([[y, x], [
    y + TILE_DEGREES,
    x + TILE_DEGREES,
  ]]);

  const xValue = x.toFixed(4);
  const yValue = y.toFixed(4);

  // get key
  const key = `${x},${y}`;
  let tokenValue: number | null;

  // if map has it
  if (cellState.has(key)) {
    tokenValue = cellState.get(key)!.tokenValue;
  } else {
    // else create one using luck
    tokenValue = possibleStartingNum[
      Math.floor(luck([x, y, "initialValue"].toString()) * 4)
    ];
  }

  // create rect, maybe change color later
  const rect = leaflet.rectangle(bounds, { color: "#ffffffff", weight: 3 })
    .addTo(
      map,
    );

  // add the rect to the feature group
  rect.addTo(featureGroup);

  // writing and buttons of pop up - take, combine, store
  const popupDiv = document.createElement("div");
  popupDiv.innerHTML =
    `<div><span id="message">There is a cell at ${xValue},${yValue}.  It has a token of ${tokenValue}.</span></div>
<button id="take">Take</button><button id="combine">Combine</button><button id = "store">store</button>`;

  // bind token number to cache
  updateDisplayedToken(rect, tokenValue);

  // take button event listener
  popupDiv.querySelector<HTMLButtonElement>("#take")!.addEventListener(
    "click",
    () => {
      // on click, if inventory token doesn't exist
      if (heldToken == null) {
        // grab token
        heldToken = tokenValue;
        statusPanelDiv.innerHTML = `${heldToken}`;

        // if win condition reached:
        if (heldToken == winCondition) {
          // create TT
          const tooltip = leaflet.tooltip({
            permanent: true,
            direction: "center",
          }).setContent(
            `Congratulations! You've reached the win condition of ${winCondition}!`,
          );

          playerMarker.bindTooltip(tooltip);
        }

        // change value of cache token
        tokenValue = null;

        // html update
        popupDiv.querySelector<HTMLSpanElement>("#message")!.innerHTML =
          `There is a cell at ${xValue},${yValue}. It has no token.`;

        // turn take button off
        popupDiv.querySelector<HTMLButtonElement>("#take")!.disabled = true;
        // turn store button on
        popupDiv.querySelector<HTMLButtonElement>("#store")!.disabled = false;
      } // if you have a token, swap
      else if (tokenValue) {
        tokenValue = swapToken(tokenValue, popupDiv, x, y);
      }
      // refresh displayed token
      updateDisplayedToken(rect, tokenValue);
      // update map value && JSON
      saveCellState(x, y, tokenValue);
      // save to JSON
      persistHeldToken();
    },
  );

  // combine button event listener
  popupDiv.querySelector<HTMLButtonElement>("#combine")!.addEventListener(
    "click",
    () => {
      // if equal values
      if (heldToken == tokenValue) {
        console.log(
          `Combining a token of value ${heldToken} to create a ${
            heldToken! * 2
          } token!`,
        );

        // double token
        tokenValue! *= 2;

        // html update
        popupDiv.querySelector<HTMLSpanElement>("#message")!.innerHTML =
          `There is a cell at ${xValue},${yValue}. It has a token of ${tokenValue}.`;

        // update inventory token and html to null
        heldToken = null;
        statusPanelDiv.innerText = " ";

        // store button turns of
        popupDiv.querySelector<HTMLButtonElement>("#store")!.disabled = true;

        // combine button turns off
        popupDiv.querySelector<HTMLButtonElement>("#combine")!.disabled = true;
      } // if there exists no token (shouldn't happen because of button update func)
      else {
        console.log(`Cannot combine!`);
      }
      // refresh displayed token
      updateDisplayedToken(rect, tokenValue);
      // update map value && JSON
      saveCellState(x, y, tokenValue);
      // save to JSON
      persistHeldToken();
    },
  );

  // store button event listener
  popupDiv.querySelector<HTMLButtonElement>("#store")!.addEventListener(
    "click",
    () => {
      // if inventory token exists and cache token exists
      if (heldToken && tokenValue) {
        // swap
        tokenValue = swapToken(tokenValue, popupDiv, x, y);
      } // else if you hold token
      else if (heldToken) {
        // token value becomes inventory token's
        tokenValue = heldToken;
        heldToken = null;

        // html updates
        statusPanelDiv.innerHTML = " ";
        popupDiv.querySelector<HTMLSpanElement>("#message")!.innerHTML =
          `There is a cell at ${xValue},${yValue}.  It has a token of ${tokenValue}`;

        // take button turns on
        popupDiv.querySelector<HTMLButtonElement>("#take")!.disabled = false;

        // store button turns off
        popupDiv.querySelector<HTMLButtonElement>("#store")!.disabled = true;
      }
      // refresh displayed token
      updateDisplayedToken(rect, tokenValue);
      // update map value && JSON
      saveCellState(x, y, tokenValue);
      // update JSON
      persistHeldToken();
    },
  );

  // bind to rect
  rect.bindPopup(() => {
    // update buttons to correctly disable
    toggleButtons(popupDiv, tokenValue, x, y);
    return popupDiv;
  });
}

// swap inventory token with given token
function swapToken(
  tokenValue: number | null,
  div: HTMLDivElement,
  x: number,
  y: number,
) {
  // standard swapping
  const temp = heldToken;
  heldToken = tokenValue;
  tokenValue = temp;

  // html updates
  statusPanelDiv.innerHTML = `${heldToken}`;
  div.querySelector<HTMLSpanElement>("#message")!.innerHTML =
    `There is a cell at ${x.toFixed(4)},${
      y.toFixed(4)
    }.  It has a token of ${tokenValue}`;

  // if win condition reached:
  if (heldToken == winCondition) {
    // create TT - maybe change to show on panel?
    const tooltip = leaflet.tooltip({
      permanent: true,
      direction: "center",
    }).setContent(
      `Congratulations! You've reached the win condition of ${winCondition}!`,
    );

    playerMarker.bindTooltip(tooltip);
  }

  return tokenValue;
}

// check which buttons to activate
function toggleButtons(
  div: HTMLDivElement,
  tokenValue: number | null,
  x: number,
  y: number,
) {
  // grab buttons
  const take = div.querySelector<HTMLButtonElement>("#take")!;
  const combine = div.querySelector<HTMLButtonElement>("#combine")!;
  const store = div.querySelector<HTMLButtonElement>("#store")!;

  // disable all
  take.disabled = true;
  combine.disabled = true;
  store.disabled = true;

  // roughly 48 meters
  const maxMeters = 0.00048 * 111320;
  // point in lat long leaflet format
  const pointLatLng = new leaflet.LatLng(y, x);

  // interact from location check
  if (pointLatLng.distanceTo(playerMarker.getLatLng()) > maxMeters) {
    return;
  }

  // if have a token, turn on take
  if (tokenValue) {
    take.disabled = false;
  }
  // if token is same as inventory token, turn on combine
  if (tokenValue == heldToken) {
    combine.disabled = false;
  }
  // if token is held, turn on store
  if (heldToken) {
    store.disabled = false;
  }
}

// function for updating visuals of tokens
function updateDisplayedToken(
  rect: leaflet.Rectangle,
  tokenValue: number | null,
) {
  if (tokenValue != null) {
    const tooltip = leaflet.tooltip({
      permanent: true,
      direction: "center",
    }).setContent(tokenValue!.toString());
    rect.bindTooltip(tooltip);
  } else {
    rect.unbindTooltip();
  }
}

function updateCircle() {
  const radius = leaflet.circleMarker(playerMarker.getLatLng(), { radius: 200 })
    .addTo(map);
  featureGroup.addLayer(radius);
}

// helper functions to disable/enable movement
function disableMovementButtons() {
  const container = document.getElementById("movementButtons");
  if (!container) return;

  container.querySelectorAll("button").forEach(btn => {
    (btn as HTMLButtonElement).disabled = true;
  });
}

function enableMovementButtons() {
  const container = document.getElementById("movementButtons");
  if (!container) return;

  container.querySelectorAll("button").forEach(btn => {
    (btn as HTMLButtonElement).disabled = false;
  });
}

// call mode at main
modeSelect.value = getInitialMode();
localStorage.setItem(LS_KEYS.MODE, modeSelect.value);

// movement controller instances
let movementController: MovementController | null = null;

function startMovementController(mode: "buttons" | "geo") {
  if (movementController) movementController.stop();
  if (mode === "geo") {
    movementController = new GeoMovement((pos) => applyPlayerMove(pos));
  } else {
    movementController = new ButtonMovement((pos) => applyPlayerMove(pos));
  }
  movementController.start();
  localStorage.setItem(LS_KEYS.MODE, mode);
}

// initial start
startMovementController(modeSelect.value as "buttons" | "geo");

// runtime switch
modeSelect.addEventListener("change", () => {
  startMovementController(modeSelect.value as "buttons" | "geo");
});

// obtainable range of caches drawn - need to update to follow person
leaflet.circleMarker(CLASSROOM_LATLNG, { radius: 200 }).addTo(featureGroup);

// generate cells
function cellGeneration() {
  // x and y by grid coords
  const x = latLongToGrid(map.getCenter().lng);
  const y = latLongToGrid(map.getCenter().lat);

  for (let i = -RANGE; i < RANGE; i++) {
    for (let j = -RANGE; j < RANGE; j++) {
      if (luck([x - i, y - j].toString()) < CELL_SPAWN_PROBABILITY) {
        spawnCell(x - i, y - j);
      }
    }
  }
}

// call at main to generate
cellGeneration();

// tie generation function and circle update to move-end
map.addEventListener("moveend", () => {
  featureGroup.clearLayers();
  updateCircle();
  cellGeneration();
});

// helper function for determining starting movement mode
function getInitialMode(): "buttons" | "geo" {
  const params = new URLSearchParams(globalThis.location.search);
  const q = params.get("movement");
  const stored = localStorage.getItem(LS_KEYS.MODE) as "buttons" | "geo" | null;
  if (q === "geolocation" || q === "geo") return "geo";
  if (q === "buttons") return "buttons";
  if (stored) return stored;
  return "buttons";
}

// movement function
function processMovement(
  location: leaflet.LatLng,
  direction: string,
): leaflet.LatLng | [number, number] {
  switch (direction) {
    case "Up":
      return [location.lat + 0.0001, location.lng];
    case "Down":
      return [location.lat - 0.0001, location.lng];
    case "Left":
      return [location.lat, location.lng - 0.0001];
    case "Right":
      return [location.lat, location.lng + 0.0001];
  }
  return [location.lat, location.lng];
}

// helper function for updating map cells
function saveCellState(x: number, y: number, tokenValue: number | null) {
  const key = `${x},${y}`;
  cellState.set(key, { tokenValue });
  // added call to JSON save
  persistCells();
}

// helper functions for converting Grid and LatLong coordinates
function latLongToGrid(x: number) {
  return Math.round(x / 0.0001);
}

function gridToLatLong(x: number) {
  return x * 0.0001;
}
