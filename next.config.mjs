/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The app is previewed behind proxies that may normalize trailing slashes;
  // serving both forms directly (no 308s) keeps any proxy from fighting the
  // app into a redirect loop.
  skipTrailingSlashRedirect: true,
  experimental: {
    // Document readers load native / worker-based modules at runtime: keep them
    // out of the server bundle so their own files (wasm, workers, .node) resolve.
    serverComponentsExternalPackages: ['pdfjs-dist', 'tesseract.js', '@napi-rs/canvas', 'jszip', 'xlsx'],
    // ship the dataset with the serverless functions that read it
    outputFileTracingIncludes: {
      '/api/**/*': ['./dataset/**/*'],
    },
  },
};

export default nextConfig;
