import { appendCarousel, clear, createCarouselItem, start } from "./Carousel.js";

// The breed selection input element.
const breedSelect = document.getElementById("breedSelect");
// The information section div element.
const infoDump = document.getElementById("infoDump");
// The progress bar div element.
const progressBar = document.getElementById("progressBar");
// The get favourites button element.
const getFavouritesBtn = document.getElementById("getFavouritesBtn");

// Step 0: Store your API key here for reference and easy access.
const API_KEY = "live_oYy2dWvJzmU1YEKnTOcf707nAjtTTrqmWZNMdcTmbFZDH1CMBDOsdhVYbxMsXcsX";

const api = axios.create({
  baseURL: "https://api.thecatapi.com/v1",
  headers: { "x-api-key": API_KEY, "Content-Type": "application/json" }
});

// Axios interceptors for timing and progress
axios.interceptors.request.use(config => {
  config.metadata = config.metadata || {};
  config.metadata.startTime = new Date();
  progressBar.style.width = "0%";
  document.body.style.cursor = "progress"; 
  console.log(`Request started at: ${config.metadata.startTime.toLocaleTimeString("en-US")}`);
  return config;
});

axios.interceptors.response.use(response => {
  document.body.style.cursor = "default";
  progressBar.style.width = "100%";
  const start = response.config?.metadata?.startTime;
  if (start) console.log(`Request took ${Date.now() - start.getTime()} ms.`);
  return response;
});

function updateProgress(progressEvent) {
  console.log("ProgressEvent obj:", progressEvent);
  if (progressEvent.lengthComputable) {
    const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
    progressBar.style.width = `${percent}%`;
  }
}

async function initialLoad() {
  try {
    const response = await api.get("/breeds");
    const catBreeds = Array.isArray(response.data) ? response.data : [];

    // Dropdown options for all breeds
    const frag = document.createDocumentFragment();
    catBreeds.forEach(catBreed => {
      const option = document.createElement("option");
      option.value = catBreed.id;
      option.textContent = catBreed.name;
      frag.appendChild(option);
    });
    breedSelect.appendChild(frag);

    // Load first breed by default
    const initialId = breedSelect.value || catBreeds[0]?.id;
    if (initialId) {
      breedSelect.value = initialId;
      await updateCarousel(initialId);
    } else {
      infoDump.textContent = "No breeds available.";
    }
  } catch (error) {
    console.error(error);
    infoDump.textContent = "Failed to load breeds";
  }
}
initialLoad();

// Carousel 
function createCarousel(data, type) {
  clear();
  if (!Array.isArray(data) || data.length === 0) {
    const msg = type === "favourites"
      ? "User does not have any favourite cat pics."
      : "No images available for this selection.";
    infoDump.appendChild(Object.assign(document.createElement("h1"), { textContent: msg }));
    return;
  }

  data.forEach(catResult => {
    const url = catResult.url || catResult.image?.url || "https://via.placeholder.com/400x300?text=No+Image";
    const alt = catResult.breeds?.[0]?.name ? `Picture of ${catResult.breeds[0].name}` : "Cat picture";
    const id = catResult.id || catResult.image_id || "";
    appendCarousel(createCarouselItem(url, alt, id));
  });

  if (type === "favourites") {
    infoDump.appendChild(Object.assign(document.createElement("h1"), { textContent: "Viewing Favourite Cat Pics!" }));
  }
  start();
}

// Clear Breed info
function clearInfo() {
  while (infoDump.firstElementChild) infoDump.removeChild(infoDump.firstElementChild);
}


function showInfo(breedInfo) {
  clearInfo();
  const frag = document.createDocumentFragment();

  frag.appendChild(Object.assign(document.createElement("h1"), {id: "info-header",textContent: `Information on the ${breedInfo.name || "selected breed"}`}));
  frag.appendChild(Object.assign(document.createElement("p"), {id: "cat-origin",innerHTML: `<strong>Origin:</strong> ${breedInfo.origin || "N/A"}`}));
  frag.appendChild(Object.assign(document.createElement("p"), {id: "cat-weight",innerHTML: `<strong>Weight:</strong> ${breedInfo.weight?.imperial || "N/A"} lbs`}));
  frag.appendChild(Object.assign(document.createElement("p"), {id: "cat-lifespan",innerHTML: `<strong>Life Span:</strong> ${breedInfo.life_span || "N/A"} years`}));
  frag.appendChild(Object.assign(document.createElement("p"), {id: "cat-traits",innerHTML: `<strong>Traits:</strong> ${breedInfo.temperament || "N/A"}`}));
  frag.appendChild(Object.assign(document.createElement("p"), {id: "cat-desc",textContent: breedInfo.description || ""}));
  frag.appendChild(Object.assign(document.createElement("p"), {id: "wikipedia",innerHTML: `Click <a id="link" href="${breedInfo.wikipedia_url || "#"}" target="_blank" rel="noopener noreferrer">here</a> to learn more about the ${breedInfo.name}.`}));

  infoDump.appendChild(frag);
}

// Update carousel 
breedSelect.addEventListener("change", e => updateCarousel(e.target.value));

async function updateCarousel(id) {
  try {
    if (!id) return;

    const response = await api.get("/images/search", {
      params: { breed_ids: id, limit: 10, format: "json" },
      onDownloadProgress: updateProgress,
    });

    let images = response.data;

    // Placeholder if there's no image
    if (!images || images.length === 0) {
      const breedName = breedSelect.selectedOptions[0].textContent;
      images = [{
        url: "https://via.placeholder.com/400x300?text=No+Image",
        breeds: [{ name: breedName }],
        id: id + "-placeholder"
      }];
    }

    createCarousel(images, "breed");

    const breedInfo = images?.[0]?.breeds?.[0] || {
      name: breedSelect.selectedOptions[0].textContent,
      origin: "N/A",
      weight: { imperial: "N/A" },
      life_span: "N/A",
      temperament: "N/A",
      description: "No description available.",
      wikipedia_url: "#"
    };

    showInfo(breedInfo);

  } catch (error) {
    console.error("updateCarousel error:", error);
    clearInfo();
    infoDump.textContent = "Failed to load images for this breed.";
  }
}

// Favourites 
export async function favourite(imgId) {
  try {
    const getFavResponse = await api.get("/favourites");
    const existing = getFavResponse.data.find(f => f.image_id === imgId);

    if (!existing) {
      const addFavResponse = await api.post("/favourites", { image_id: imgId });
      console.log("Added favorite:", addFavResponse.data);
    } else {
      const deleteFavResponse = await api.delete(`/favourites/${existing.id}`);
      console.log("Deleted favorite:", deleteFavResponse.data);
    }
  } catch (error) {
    console.error("favourite error:", error);
  }
}

getFavouritesBtn.addEventListener("click", getFavourites);

async function getFavourites(e) {
  try {
    if (e.target !== e.currentTarget) return;
    const favourites = await api.get("/favourites", { onDownloadProgress: updateProgress });
    clearInfo();
    createCarousel(favourites.data, "favourites");
  } catch (error) {
    console.error("getFavourites error:", error);
    clearInfo();
    infoDump.textContent = "Failed to load favourites.";
  }
}
