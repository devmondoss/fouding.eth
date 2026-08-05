import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16.3's CLI runner can close before collecting the complete JSON from
  // `tsc --showConfig`. TypeScript 5.9 still provides the compiler API, which
  // avoids that stdout race without skipping or weakening type checking.
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
