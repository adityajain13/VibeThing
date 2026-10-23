import '@electron-toolkit/preload'

interface Shortcut {
  id: string
  command: string
}

declare global {
  interface Window {
    api: {
      on: (
        channel: string,
        listener: (...args: unknown[]) => void
      ) => () => void
      findCarThing: () => Promise<string | boolean>
      findSetupCarThing: () => Promise<
        'not_found' | 'not_installed' | 'ready'
      >
      rebootCarThing: () => Promise<void>
      restoreCarThing: () => Promise<void>
      installApp: () => Promise<string | true>
      startServer: () => Promise<void>
      stopServer: () => Promise<void>
      getServerInfo: () => Promise<{
        running: boolean
        port: number | null
      }>
      forwardSocketServer: () => Promise<void>
      getVersion: () => Promise<string>
      getStorageValue: (key: string) => Promise<unknown>
      setStorageValue: (key: string, value: unknown) => Promise
      triggerCarThingStateUpdate: () => void
      uploadShortcutImage: (name: string) => Promise<string>
      removeNewShortcutImage: () => Promise<void>
      getShortcuts: () => Promise<Shortcut[]>
      addShortcut: (shortcut: Shortcut) => Promise<void>
      removeShortcut: (id: string) => Promise<void>
      updateShortcut: (shortcut: Shortcut) => Promise<void>
      isDevMode: () => Promise<boolean>
      getBrightness: () => Promise<number>
      setBrightness: (brightness: number) => Promise<void>
      getPatches: () => Promise<
        { name: string; description: string; installed: boolean }[] | false
      >
      applyPatch: (patchName: string) => Promise<void>
      validateConfig: (
        handlerName: string,
        config: unknown
      ) => Promise<boolean>
      getPlaybackHandlerConfig: (handlerName: string) => Promise<unknown>
      setPlaybackHandlerConfig: (
        handlerName: string,
        config: unknown
      ) => Promise<void>
      restartPlaybackHandler: () => Promise<void>
      hasCustomClient: () => Promise<boolean>
      importCustomClient: () => Promise<void>
      removeCustomClient: () => Promise<void>
      getLogs: () => Promise<string[]>
      clearLogs: () => Promise<void>
      downloadLogs: () => Promise<void>
      uploadScreensaverImage: () => Promise<{
        success: boolean
        error?: string
        message?: string
      }>
      removeScreensaverImage: () => Promise<boolean>
      hasCustomScreensaverImage: () => Promise<boolean>
      openDevTools: () => void
      getChannel: () => Promise<'stable' | 'nightly'>
      checkUpdate: () => Promise<{
        currentVersion: string
        latestVersion: string
        downloadUrl: string
      } | null>
      findOpenPort: () => Promise<number>
      isPortOpen: (port: number) => Promise<boolean>
      geocodeLocation: (
        query: string
      ) => Promise<{ name: string; latitude: number; longitude: number }[]>
      testMacro: (macro: unknown) => Promise<boolean>
      getMixerTargets: () => Promise<{ id: string; name: string }[] | null>
      validateKeys: (keys: string) => Promise<boolean>
      getClientConfig: () => Promise<unknown>
      getMacros: () => Promise<unknown[]>
      hasPreviewClient: () => Promise<boolean>
      exportSettings: () => Promise<
        { ok: true; path: string; count: number } | { ok: false; canceled?: boolean; error?: string }
      >
      getPreviewConnection: () => Promise<{ port: number; password: string } | null>
      getVlcSettings: () => Promise<{ enabled: boolean; port: number; hasPassword: boolean }>
      saveVlcSettings: (s: { enabled: boolean; port: number; password?: string }) => Promise<boolean>
      testVlc: (s: { port: number; password?: string }) => Promise<'ok' | 'auth' | 'offline'>
      importSettings: () => Promise<
        { ok: true; count: number } | { ok: false; canceled?: boolean; error?: string }
      >
    }
  }
}
