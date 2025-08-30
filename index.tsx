/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality } from "@google/genai";

// --- DOM Element References ---
const imageUploadArea = document.getElementById(
  "image-upload-area"
) as HTMLDivElement;
const imageUploadInput = document.getElementById(
  "image-upload"
) as HTMLInputElement;
const imageUploadPreview = document.getElementById(
  "image-upload-preview"
) as HTMLImageElement;
const imageUploadPlaceholder = document.getElementById(
  "image-upload-placeholder"
) as HTMLDivElement;
const roomTypeSelect = document.getElementById(
  "room-type-select"
) as HTMLSelectElement;
const styleSelect = document.getElementById("style-select") as HTMLSelectElement;
const useCustomColorsCheckbox = document.getElementById(
  "use-custom-colors"
) as HTMLInputElement;
const removeFurnitureCheckbox = document.getElementById(
  "remove-furniture-checkbox"
) as HTMLInputElement;
const colorPickerGroup = document.getElementById(
  "color-picker-group"
) as HTMLDivElement;
const primaryColorInput = document.getElementById(
  "primary-color"
) as HTMLInputElement;
const secondaryColorInput = document.getElementById(
  "secondary-color"
) as HTMLInputElement;
const inspirationUploadInput = document.getElementById(
  "inspiration-upload"
) as HTMLInputElement;
const inspirationGallery = document.getElementById(
  "inspiration-gallery"
) as HTMLDivElement;
const generateButton = document.getElementById(
  "generate-button"
) as HTMLButtonElement;
const tweakControls = document.getElementById(
  "tweak-controls"
) as HTMLDivElement;
const tweakModeButton = document.getElementById(
  "tweak-mode-button"
) as HTMLButtonElement;
const applyTweaksButton = document.getElementById(
  "apply-tweaks-button"
) as HTMLButtonElement;
const originalImage = document.getElementById(
  "original-image"
) as HTMLImageElement;
const stagedImage = document.getElementById("staged-image") as HTMLImageElement;
const originalPlaceholder = document.getElementById(
  "original-placeholder"
) as HTMLParagraphElement;
const stagedPlaceholder = document.getElementById(
  "staged-placeholder"
) as HTMLParagraphElement;
const stagedHint = document.getElementById("staged-hint") as HTMLSpanElement;
const loader = document.getElementById("loader") as HTMLDivElement;
const identifierLoader = document.getElementById(
  "identifier-loader"
) as HTMLDivElement;
const errorMessage = document.getElementById(
  "error-message"
) as HTMLDivElement;
const customPrompt = document.getElementById(
  "custom-prompt"
) as HTMLTextAreaElement;
const originalImageWrapper = document.getElementById(
  "original-image-wrapper"
) as HTMLDivElement;
const stagedImageWrapper = document.getElementById(
  "staged-image-wrapper"
) as HTMLDivElement;
const historyContainer = document.getElementById(
  "history-container"
) as HTMLElement;
const historyGallery = document.getElementById(
  "history-gallery"
) as HTMLDivElement;
// Modal elements
const annotationModalOverlay = document.getElementById(
  "annotation-modal-overlay"
) as HTMLDivElement;
const annotationInput = document.getElementById(
  "annotation-input"
) as HTMLTextAreaElement;
const modalSaveButton = document.getElementById(
  "modal-save-button"
) as HTMLButtonElement;
const modalCancelButton = document.getElementById(
  "modal-cancel-button"
) as HTMLButtonElement;

// --- State ---
let uploadedImageBase64: string | null = null;
let uploadedMimeType: string | null = null;
let stagedImageBase64: string | null = null;
let stagedMimeType: string | null = null;
let isLoading = false;
let isIdentifyingItem = false;
let isAnnotationMode = false;
type Marker = { x: number; y: number; annotation: string };
let originalMarkers: Marker[] = [];
let stagedMarkers: Marker[] = [];
let tempMarkerPosition: { x: number; y: number } | null = null;
let annotatingOn: "original" | "staged" = "original";
type HistoryItem = { imageData: string; mimeType: string };
let history: HistoryItem[] = [];
type InspirationPhoto = { base64: string; mimeType: string };
let inspirationPhotos: InspirationPhoto[] = [];

// --- Constants ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const imageEditModel = "gemini-2.5-flash-image-preview";
const textModel = "gemini-2.5-flash";

// --- Event Listeners ---
imageUploadArea.addEventListener("click", () => imageUploadInput.click());
imageUploadInput.addEventListener("change", handleImageUpload);
imageUploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  imageUploadArea.classList.add("dragging");
});
imageUploadArea.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  imageUploadArea.classList.remove("dragging");
});
imageUploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  imageUploadArea.classList.remove("dragging");
  if (e.dataTransfer?.files) {
    imageUploadInput.files = e.dataTransfer.files;
    handleImageUpload({ target: imageUploadInput } as unknown as Event);
  }
});

inspirationUploadInput.addEventListener("change", handleInspirationUpload);
inspirationGallery.addEventListener("click", handleRemoveInspiration);
useCustomColorsCheckbox.addEventListener("change", toggleColorPickers);
generateButton.addEventListener("click", handleGenerateClick);
tweakModeButton.addEventListener("click", toggleAnnotationMode);
applyTweaksButton.addEventListener("click", handleApplyTweaksClick);
originalImageWrapper.addEventListener("click", (e) =>
  handleImageWrapperClick(e, "original")
);
stagedImageWrapper.addEventListener("click", handleStagedImageClick);
historyGallery.addEventListener("click", handleHistoryClick);
modalSaveButton.addEventListener("click", handleSaveAnnotation);
modalCancelButton.addEventListener("click", hideAnnotationModal);
annotationModalOverlay.addEventListener("click", (e) => {
  if (e.target === annotationModalOverlay) {
    hideAnnotationModal();
  }
});

// --- Functions ---

/**
 * Handles the main room image file input change event.
 */
async function processUploadedFile(file: File) {
  originalMarkers = []; // Reset markers on new image upload
  renderMarkers();

  try {
    const { base64, mimeType } = await fileToBase64(file);
    uploadedImageBase64 = base64;
    uploadedMimeType = mimeType;
    const dataUrl = `data:${mimeType};base64,${base64}`;
    originalImage.src = dataUrl;
    imageUploadPreview.src = dataUrl;
  } catch (err) {
    console.error("Error reading file:", err);
    displayError("Could not read the selected image. Please try another one.");
    uploadedImageBase64 = null;
  }
  updateUIState();
}

async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    uploadedImageBase64 = null;
    updateUIState();
    return;
  }
  await processUploadedFile(file);
}

/**
 * Handles the inspiration image file input change event.
 */
async function handleInspirationUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files) return;

  isLoading = true;
  updateUIState();

  try {
    const newPhotos = await Promise.all(
      Array.from(files).map((file) => fileToBase64(file))
    );
    inspirationPhotos.push(...newPhotos);
    renderInspirationGallery();
  } catch (err) {
    console.error("Error reading inspiration files:", err);
    displayError("Could not read one or more inspiration images.");
  } finally {
    isLoading = false;
    updateUIState();
    // Clear the input so the same files can be selected again
    target.value = "";
  }
}

/**
 * Renders the gallery of inspiration photo thumbnails.
 */
function renderInspirationGallery() {
  inspirationGallery.innerHTML = "";
  inspirationPhotos.forEach((photo, index) => {
    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = "inspiration-thumbnail";

    const img = document.createElement("img");
    img.src = `data:${photo.mimeType};base64,${photo.base64}`;
    img.alt = `Inspiration image ${index + 1}`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "×";
    removeBtn.dataset.index = index.toString();
    removeBtn.setAttribute("aria-label", `Remove inspiration image ${index + 1}`);

    thumbWrapper.appendChild(img);
    thumbWrapper.appendChild(removeBtn);
    inspirationGallery.appendChild(thumbWrapper);
  });
}

/**
 * Handles click on a remove button in the inspiration gallery.
 */
function handleRemoveInspiration(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.classList.contains("remove-btn") && target.dataset.index) {
    const index = parseInt(target.dataset.index, 10);
    inspirationPhotos.splice(index, 1);
    renderInspirationGallery();
  }
}

/**
 * Enables or disables the color picker inputs based on the checkbox.
 */
function toggleColorPickers() {
  const enabled = useCustomColorsCheckbox.checked;
  colorPickerGroup.classList.toggle("disabled", !enabled);
  primaryColorInput.disabled = !enabled;
  secondaryColorInput.disabled = !enabled;
}

/**
 * Main handler for clicks on the staged image.
 * Branches to either annotation or product search based on mode.
 */
function handleStagedImageClick(event: MouseEvent) {
  if (isAnnotationMode) {
    handleImageWrapperClick(event, "staged");
  } else {
    handleProductSearch(event);
  }
}

/**
 * Handles clicks on image wrappers to place a marker.
 */
function handleImageWrapperClick(
  event: MouseEvent,
  target: "original" | "staged"
) {
  if (target === "original" && !uploadedImageBase64) return;
  if (target === "staged" && !stagedImageBase64) return;

  annotatingOn = target;
  const wrapper =
    target === "original" ? originalImageWrapper : stagedImageWrapper;
  const rect = wrapper.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (
    event.target instanceof HTMLElement &&
    event.target.classList.contains("marker")
  )
    return;

  const xPercent = (x / rect.width) * 100;
  const yPercent = (y / rect.height) * 100;

  tempMarkerPosition = { x: xPercent, y: yPercent };
  showAnnotationModal();
}

/**
 * Toggles the annotation mode for the staged image.
 */
function toggleAnnotationMode() {
  isAnnotationMode = !isAnnotationMode;
  stagedImageWrapper.classList.toggle("annotation-mode", isAnnotationMode);
  tweakModeButton.classList.toggle("active", isAnnotationMode);
  tweakModeButton.textContent = isAnnotationMode
    ? "Cancel Tweak"
    : "Tweak Image";
  applyTweaksButton.hidden = !isAnnotationMode;

  if (!isAnnotationMode) {
    // Clear markers when canceling tweak mode
    stagedMarkers = [];
    renderMarkers();
  }
}

function showAnnotationModal() {
  annotationInput.value = "";
  annotationModalOverlay.style.display = "flex";
  annotationInput.focus();
}

function hideAnnotationModal() {
  annotationModalOverlay.style.display = "none";
  tempMarkerPosition = null;
}

function handleSaveAnnotation() {
  const annotation = annotationInput.value.trim();
  if (annotation && tempMarkerPosition) {
    const markers =
      annotatingOn === "original" ? originalMarkers : stagedMarkers;
    markers.push({ ...tempMarkerPosition, annotation });
    renderMarkers();
    hideAnnotationModal();
  }
}

/**
 * Renders all markers onto both image wrappers.
 */
function renderMarkers() {
  originalImageWrapper
    .querySelectorAll(".marker")
    .forEach((el) => el.remove());
  stagedImageWrapper.querySelectorAll(".marker").forEach((el) => el.remove());

  originalMarkers.forEach((marker, index) => {
    const markerEl = createMarkerElement(marker, index);
    originalImageWrapper.appendChild(markerEl);
  });

  stagedMarkers.forEach((marker, index) => {
    const markerEl = createMarkerElement(marker, index);
    stagedImageWrapper.appendChild(markerEl);
  });
}

function createMarkerElement(marker: Marker, index: number): HTMLDivElement {
  const markerEl = document.createElement("div");
  markerEl.className = "marker";
  markerEl.style.left = `${marker.x}%`;
  markerEl.style.top = `${marker.y}%`;
  markerEl.textContent = `${index + 1}`;
  return markerEl;
}

/**
 * Handles the initial "Stage My Room" click.
 */
async function handleGenerateClick() {
  if (!uploadedImageBase64 || !uploadedMimeType || isLoading) {
    return;
  }

  const roomType = roomTypeSelect.value;
  const style = styleSelect.value;
  const customInstructions = customPrompt.value.trim();
  const shouldRemoveFurniture = removeFurnitureCheckbox.checked;

  let promptText = ``;
  if (shouldRemoveFurniture) {
    promptText = `You are an expert interior designer.
Completely replace all furniture and decor in the image. You must remove everything that is not part of the room's permanent architecture (walls, windows, floor, ceiling).
Then, stage the room as a photorealistic "${style}" ${roomType.toLowerCase()}.
The final image must show the same room but with a completely new set of furniture and decor appropriate for the new room type and style.`;
  } else {
    promptText = `You are an expert interior designer.
Your task is to add new furniture and decor to the room shown in the image. If the room is not empty, complement the items that are already there.
IMPORTANT: You must preserve the existing room's architecture (walls, windows, doors, floor, ceiling). Do not remove existing furniture.
Stage the room with additional photorealistic virtual furniture to create a complete "${style}" ${roomType.toLowerCase()}.`;
  }

  if (useCustomColorsCheckbox.checked) {
    const primaryColor = primaryColorInput.value;
    const secondaryColor = secondaryColorInput.value;
    promptText += ` The color scheme should heavily feature the primary color "${primaryColor}" with "${secondaryColor}" used for accents and secondary elements.`;
  } else {
    promptText += ` The color scheme should be aesthetically pleasing and appropriate for the chosen "${style}" style.`;
  }

  if (inspirationPhotos.length > 0) {
    promptText += `\nUse the provided inspiration images to heavily influence the style, mood, furniture choices, and overall aesthetic.`;
  }

  if (customInstructions) {
    promptText += `\nAlso consider this general instruction: "${customInstructions}".`;
  }

  if (originalMarkers.length > 0) {
    promptText +=
      "\nSeveral specific spots have been marked on the image for furniture placement. Follow these instructions carefully:";
    originalMarkers.forEach((marker, index) => {
      promptText += ` For point ${
        index + 1
      } (located at approximately ${Math.round(
        marker.x
      )}% from the left and ${Math.round(
        marker.y
      )}% from the top), place the following: "${marker.annotation}".`;
    });
  }

  promptText +=
    "\nOnly return the final staged image, do not add any text description.";

  const parts: any[] = [];
  parts.push({
    inlineData: { data: uploadedImageBase64, mimeType: uploadedMimeType },
  });

  inspirationPhotos.forEach((photo) => {
    parts.push({
      inlineData: { data: photo.base64, mimeType: photo.mimeType },
    });
  });

  parts.push({ text: promptText });

  await callImageEditAPI(parts, true);
}

/**
 * Handles the "Apply Tweaks" click.
 */
async function handleApplyTweaksClick() {
  if (!stagedImageBase64 || !stagedMimeType || isLoading) return;

  let promptText = `You are an expert interior designer.
IMPORTANT: You must preserve the existing room's architecture (walls, windows, doors, etc.) unless an annotation specifically asks to modify it (e.g., 'make this window larger').
Take the provided image and make ONLY the following changes based on the numbered markers. Do not change any other part of the image.`;

  if (useCustomColorsCheckbox.checked) {
    promptText += ` The tweaked image should remain consistent with the original style ("${styleSelect.value}") and color palette (primary: "${primaryColorInput.value}", secondary: "${secondaryColorInput.value}").`;
  } else {
    promptText += ` The tweaked image should remain consistent with the original image's overall style and color palette.`;
  }

  if (stagedMarkers.length > 0) {
    stagedMarkers.forEach((marker, index) => {
      promptText += `\nAt point ${
        index + 1
      } (located at approximately ${Math.round(
        marker.x
      )}% from the left and ${Math.round(
        marker.y
      )}% from the top), make this change: "${marker.annotation}".`;
    });
  } else {
    displayError("Please add at least one annotation to tweak the image.");
    return;
  }

  promptText += "\nOnly return the final modified image, with no other text.";

  const imagePart = {
    inlineData: {
      data: stagedImageBase64,
      mimeType: stagedMimeType,
    },
  };
  const textPart = { text: promptText };

  await callImageEditAPI([imagePart, textPart], false);
}

/**
 * Handles clicking on the staged image to find a product on Amazon.
 */
async function handleProductSearch(event: MouseEvent) {
  if (!stagedImageBase64 || isIdentifyingItem || isLoading) return;

  const rect = stagedImageWrapper.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const xPercent = (x / rect.width) * 100;
  const yPercent = (y / rect.height) * 100;

  isIdentifyingItem = true;
  updateUIState();
  clearError();

  try {
    const prompt = `Analyze this image. The user clicked at the coordinate (${Math.round(
      xPercent
    )}%, ${Math.round(
      yPercent
    )}%). Identify the main piece of furniture or decor item at that location. Respond with a short, concise search query for this item, suitable for an e-commerce website like Amazon. For example: 'modern blue sofa', 'round wooden coffee table', 'industrial floor lamp'. Do not include any other text, preamble, or explanation in your response. Just the search query.`;

    const imagePart = {
      inlineData: { data: stagedImageBase64, mimeType: stagedMimeType! },
    };
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: textModel,
      contents: { parts: [imagePart, textPart] },
    });

    const searchQuery = response.text.trim();

    if (searchQuery) {
      const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(
        searchQuery
      )}`;
      window.open(amazonUrl, "_blank");
    } else {
      throw new Error("Could not identify an item to search for.");
    }
  } catch (error) {
    console.error("Product identification failed:", error);
    let message = "Could not identify the selected item. Please try another spot.";
    if (error instanceof Error && error.message) {
      message = error.message;
    }
    displayError(message);
  } finally {
    isIdentifyingItem = false;
    updateUIState();
  }
}

/**
 * Generic function to call the Gemini Image Edit API.
 */
async function callImageEditAPI(parts: any[], isFirstGeneration: boolean) {
  isLoading = true;
  updateUIState();
  clearError();

  try {
    const response = await ai.models.generateContent({
      model: imageEditModel,
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const imagePartResponse = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData
    );

    if (imagePartResponse?.inlineData) {
      const { data, mimeType } = imagePartResponse.inlineData;
      stagedImageBase64 = data;
      stagedMimeType = mimeType;
      stagedImage.src = `data:${mimeType};base64,${data}`;
      history.push({ imageData: data, mimeType });
      renderHistory();

      if (isFirstGeneration) {
        originalMarkers = [];
      }
      // Reset annotation mode and markers after a successful tweak
      isAnnotationMode = false;
      stagedMarkers = [];
      renderMarkers();
    } else {
      throw new Error(
        "The model did not return an image. Please try again with a different image or prompt."
      );
    }
  } catch (error) {
    console.error("Gemini API call failed:", error);
    let message = "An unexpected error occurred. Please try again later.";
    if (error instanceof Error) {
      message = error.message;
    }
    displayError(message);
    if (isFirstGeneration) stagedImage.src = "";
  } finally {
    isLoading = false;
    updateUIState();
  }
}

/**
 * Renders the history gallery.
 */
function renderHistory() {
  historyContainer.hidden = history.length === 0;
  historyGallery.innerHTML = "";

  history.forEach((item, index) => {
    const historyItem = document.createElement("div");
    historyItem.className = "history-item";
    historyItem.dataset.index = index.toString();

    const img = document.createElement("img");
    img.src = `data:${item.mimeType};base64,${item.imageData}`;
    img.alt = `Design Iteration ${index + 1}`;
    historyItem.appendChild(img);
    historyGallery.appendChild(historyItem);
  });
}

/**
 * Handles clicking on a history item to restore it.
 */
function handleHistoryClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const historyItem = target.closest<HTMLElement>(".history-item");

  if (historyItem && historyItem.dataset.index) {
    const index = parseInt(historyItem.dataset.index, 10);
    const item = history[index];
    if (item) {
      stagedImageBase64 = item.imageData;
      stagedMimeType = item.mimeType;
      stagedImage.src = `data:${item.mimeType};base64,${item.imageData}`;
      stagedMarkers = [];
      isAnnotationMode = false;
      renderMarkers();
      updateUIState();
    }
  }
}

function updateUIState() {
  const isBusy = isLoading || isIdentifyingItem;

  generateButton.disabled = !uploadedImageBase64 || isBusy;
  if (isLoading) {
      generateButton.innerHTML = `<div class="button-spinner"></div> Staging...`;
  } else {
      generateButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg> Stage My Room`;
  }
  
  tweakModeButton.disabled = isBusy;
  applyTweaksButton.disabled = isBusy;

  originalPlaceholder.style.display = uploadedImageBase64 ? "none" : "block";
  originalImage.style.display = uploadedImageBase64 ? "block" : "none";
  originalImageWrapper.classList.toggle("has-image", !!uploadedImageBase64);

  // Sidebar image preview
  imageUploadPlaceholder.hidden = !!uploadedImageBase64;
  imageUploadPreview.style.display = uploadedImageBase64 ? "block" : "none";
  imageUploadArea.classList.toggle("has-image", !!uploadedImageBase64);

  loader.style.display = isLoading ? "flex" : "none";
  identifierLoader.style.display = isIdentifyingItem ? "flex" : "none";

  const hasStagedImage = stagedImageBase64 && !isLoading;
  stagedPlaceholder.style.display =
    hasStagedImage || isLoading ? "none" : "block";
  stagedImage.style.display = hasStagedImage ? "block" : "none";
  tweakControls.hidden = !hasStagedImage;
  stagedHint.hidden = !hasStagedImage;
  stagedImageWrapper.classList.toggle("has-image", hasStagedImage);

  // Sync annotation mode UI, but only if not busy
  if (!isBusy) {
    stagedImageWrapper.classList.toggle("annotation-mode", isAnnotationMode);
    tweakModeButton.classList.toggle("active", isAnnotationMode);
    tweakModeButton.textContent = isAnnotationMode
      ? "Cancel Tweak"
      : "Tweak Image";
    applyTweaksButton.hidden = !isAnnotationMode;
  }
}

function displayError(message: string) {
  errorMessage.textContent = message;
  errorMessage.style.display = "block";
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.style.display = "none";
}

function fileToBase64(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
  });
}

// Initial UI state update on page load
toggleColorPickers();
updateUIState();
