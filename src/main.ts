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

// map
const cellState = new Map<string, { tokenValue: number | null }>();

// text array for buttons
const direction = ["Up", "Down", "Left", "Right"];

direction.forEach((item) => {
  // add buttons
  const directionButton = document.createElement("button");
  directionButton.innerHTML = item;
  controlPanelDiv.append(directionButton);

  directionButton.addEventListener("click", () => {
    // move in directionection with movement function
    playerMarker.setLatLng(processMovement(playerMarker.getLatLng(), item));
    // clear layers first
    featureGroup.clearLayers();
    // update circle
    updateCircle();
    // generate cells
    cellGeneration();
    // update map view
    map.setView(playerMarker.getLatLng());
  });
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

// win condition
const winCondition = 32;

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

  const possibleStartingNum = [0, 2, 4, 8, 16];

  // use luck to get random number 0-4
  let tokenValue: number | null = possibleStartingNum[
    Math.floor(
      luck([x, y, "initialValue"].toString()) * 4,
    )
  ];

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
    },
  );

  // combine button event listener
  popupDiv.querySelector<HTMLButtonElement>("#combine")!.addEventListener(
    "click",
    () => {
      // if equal values
      if (heldToken == tokenValue) {
        console.log(
          `Combiing a token of value ${heldToken} to create a ${
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

        // store button turns on
        popupDiv.querySelector<HTMLButtonElement>("#store")!.disabled = true;
      } // if there exists no token (shouldn't happen because of button update func)
      else {
        console.log(`Cannot combine!`);
      }
      // refresh displayed token
      updateDisplayedToken(rect, tokenValue);
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
      }
      // refresh displayed token
      updateDisplayedToken(rect, tokenValue);
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
function _saveCellState(x: number, y: number, tokenValue: number | null) {
  const key = `${x},${y}`;
  cellState.set(key, { tokenValue });
}

// helper functions for converting Grid and LatLong coordinates
function latLongToGrid(x: number) {
  return Math.round(x / 0.0001);
}

function gridToLatLong(x: number) {
  return x * 0.0001;
}
