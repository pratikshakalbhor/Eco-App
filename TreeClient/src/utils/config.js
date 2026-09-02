// Centralised API configuration.
//
// The backend URL is provided at build time via the VITE_API_URL
// environment variable:
//   Development: VITE_API_URL=http://localhost:8080
//   Production:  VITE_API_URL=<deployed backend URL>
//
// The backend is not deployed yet. In a production build, VITE_API_URL
// MUST be set to the deployed backend URL before building. If it is
// absent in production we fail loudly rather than silently hitting
// localhost or a made-up domain.

const configuredURL = import.meta.env.VITE_API_URL;

export const API_URL = (() => {
  if (configuredURL) return configuredURL;
  if (import.meta.env.PROD) {
    throw new Error(
      "VITE_API_URL is not set. Configure it to your deployed backend URL before building for production."
    );
  }
  // Development fallback.
  return "http://localhost:8080";
})();

export default API_URL;
