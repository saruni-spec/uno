const params = new URLSearchParams(window.location.search);
const backendFromQuery = params.get("backend");
const backendFromStorage = localStorage.getItem("shout.useBackendData");
const useBackend =
  backendFromQuery === "1" ||
  backendFromQuery === "true" ||
  backendFromStorage === "1" ||
  backendFromStorage === "true";

window.APP_CONFIG = {
  USE_BACKEND_DATA: useBackend,
  API_BASE_URL: localStorage.getItem("shout.apiBaseUrl") || "http://localhost:4000/api",
};
