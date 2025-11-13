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

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

let heldToken: number | null = 2;

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
statusPanelDiv.innerText = `${heldToken}`;
document.body.append(statusPanelDiv);

// Our classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const RANGE = 16;
const CELL_SPAWN_PROBABILITY = 0.5;

// map
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

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
playerMarker.bindTooltip("Current Location");

function spawnCell(x: number, y: number) {
  const origin = CLASSROOM_LATLNG;
  const bounds = leaflet.latLngBounds([
    [origin.lat + x * TILE_DEGREES, origin.lng + y * TILE_DEGREES],
    [origin.lat + (x + 1) * TILE_DEGREES, origin.lng + (y + 1) * TILE_DEGREES],
  ]);

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

  // bind token number to cache
  updateDisplayedToken(rect, tokenValue);

  // writing and buttons of pop up - take, combine, store
  const popupDiv = document.createElement("div");
  popupDiv.innerHTML =
    `<div><span id="message">There is a cell at ${x},${y}.  It has a token of ${tokenValue}.</span></div>
<button id="take">Take</button><button id="combine">Combine</button><button id = "store">store</button>`;

  // take button event listener
  popupDiv.querySelector<HTMLButtonElement>("#take")!.addEventListener(
    "click",
    () => {
      // on click, if inventory token doesn't exist
      if (heldToken == null) {
        console.log(`You have no token.  Picking up token of ${tokenValue}`);

        // grab token
        heldToken = tokenValue;
        statusPanelDiv.innerHTML = `${heldToken}`;

        // change value of cache token
        tokenValue = null;

        // html update
        popupDiv.querySelector<HTMLSpanElement>("#message")!.innerHTML =
          `There is a cell at ${x},${y}. It has no token.`;

        // turn take button off
        popupDiv.querySelector<HTMLButtonElement>("#take")!.disabled = true;
        // turn store button on
        popupDiv.querySelector<HTMLButtonElement>("#store")!.disabled = false;
      } // if you have a token, swap
      else if (tokenValue) {
        tokenValue = swapToken(tokenValue, popupDiv, x, y);
      } // if there exists no token (shouldn't happen because of button update func)
      else {
        console.log("Cannot take null token");
      }
      // refresh buttons
      checkButtons(popupDiv, tokenValue, x, y);
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
          `There is a cell at ${x},${y}. It has a token of ${tokenValue}.`;

        // update inventory token and html to null
        heldToken = null;
        statusPanelDiv.innerText = `${heldToken}`;

        // store button turns on
        popupDiv.querySelector<HTMLButtonElement>("#store")!.disabled = true;
      } // if there exists no token (shouldn't happen because of button update func)
      else {
        console.log(`Cannot combine!`);
      }
      // refresh buttons
      checkButtons(popupDiv, tokenValue, x, y);
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
        console.log(`Storing token into cell`);

        // token value becomes inventory token's
        tokenValue = heldToken;
        heldToken = null;

        // html updates
        statusPanelDiv.innerHTML = `${heldToken}`;
        popupDiv.querySelector<HTMLSpanElement>("#message")!.innerHTML =
          `There is a cell at ${x},${y}.  It has a token of ${tokenValue}`;

        // take button turns on
        popupDiv.querySelector<HTMLButtonElement>("#take")!.disabled = false;
      } // if there exists no token (shouldn't happen because of button update func)
      else {
        console.log("Player has no token. Cannot store anything");
      }
      // refresh buttons
      checkButtons(popupDiv, tokenValue, x, y);
      // refresh displayed token
      updateDisplayedToken(rect, tokenValue);
    },
  );

  // bind to rect
  rect.bindPopup(() => {
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
  console.log(
    `You have a token in your inventory.  Swapping inventory with cell`,
  );
  const temp = heldToken;
  heldToken = tokenValue;
  tokenValue = temp;
  statusPanelDiv.innerHTML = `${heldToken}`;
  div.querySelector<HTMLSpanElement>("#message")!.innerHTML =
    `There is a cell at ${x},${y}.  It has a token of ${tokenValue}`;
  return tokenValue;
}

// check which buttons to activate
function checkButtons(
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

  // interact from location check
  if (Math.hypot(-x, -y) > 4.5) {
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

// obtainable range of caches drawn
leaflet.circleMarker(CLASSROOM_LATLNG, { radius: 200 }).addTo(map);
for (let i = -RANGE; i < RANGE; i++) {
  for (let j = -RANGE; j < RANGE; j++) {
    if (luck([i, j].toString()) < CELL_SPAWN_PROBABILITY) {
      spawnCell(i, j);
    }
  }
}
