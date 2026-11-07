const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// HSTS only makes sense (and is only correct) over HTTPS — meaningless,
// and slightly wrong, to send in dev over plain HTTP.
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Phase 12's test/E2E servers set this to build into their own
  // directory (e.g. `.next-test`) instead of the default `.next` —
  // sharing `.next` with a concurrently-running regular `next dev`
  // caused real build corruption from both processes touching the same
  // incremental-compilation cache at once (see tests/setup/global-setup.js).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
