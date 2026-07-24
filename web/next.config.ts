import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Let webpack resolve the byte-identical vendored signer files, whose imports use `.js`
    // specifiers pointing at `.ts` sources (try .js first so node_modules is unaffected).
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts"],
      ".jsx": [".jsx", ".tsx"],
      ".mjs": [".mjs", ".mts"],
    };
    return config;
  },
};

export default nextConfig;
