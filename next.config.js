/** @type {import('next').NextConfig} */
const webpack = require("webpack");
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^@react-native-async-storage\/async-storage$/,
        path.resolve(__dirname, "src/lib/asyncStorageMock.js")
      )
    );
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
