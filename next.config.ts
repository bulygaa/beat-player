import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md is hand-written and the repo keeps exactly three markdown files, so `next dev` must not add or
  // rewrite agent files.
  agentRules: false,
};

export default nextConfig;
