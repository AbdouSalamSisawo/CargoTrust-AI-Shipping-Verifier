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
    // Files read from computed paths at runtime are invisible to the bundler's
    // tracing, so list them for serverless hosting (Vercel): the sample inbox,
    // the bundled OCR language model and pdf.js's standard fonts.
    outputFileTracingIncludes: {
      '/**/*': [
        './dataset/**/*',
        './eng.traineddata',
        './node_modules/pdfjs-dist/standard_fonts/**/*',
        // pdf.js loads its worker, and tesseract.js its worker script and wasm core, by computed path
        './node_modules/pdfjs-dist/legacy/build/**/*',
        './node_modules/tesseract.js/src/**/*',
        './node_modules/tesseract.js-core/**/*',
      ],
    },
  },
};

export default nextConfig;
