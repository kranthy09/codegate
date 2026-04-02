import type { NextConfig } from 'next'

const config: NextConfig = {
  serverExternalPackages: ['googleapis'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : []
      config.externals = [...externals, '@monaco-editor/react', '@excalidraw/excalidraw']
    }
    return config
  },
}

export default config
