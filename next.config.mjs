/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The app is previewed behind proxies that may normalize trailing slashes;
  // serving both forms directly (no 308s) keeps any proxy from fighting the
  // app into a redirect loop.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
