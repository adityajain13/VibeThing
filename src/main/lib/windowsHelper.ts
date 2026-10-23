import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

import { log, LogLevel } from './utils.js'

/**
 * A long-lived PowerShell process hosting a small C# class (compiled once via
 * Add-Type) that talks to the Windows Core Audio APIs and sends keystrokes.
 * Avoids shipping native modules or third-party binaries.
 *
 * Protocol: one request per line "<id>|<command> <args>", one response per
 * line "<id>|<json>".
 */

const CSHARP = String.raw`
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace GlanceThingPlus {
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumeratorCom {}

  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
  }

  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
  }

  [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioEndpointVolume {
    [PreserveSig] int RegisterControlChangeNotify(IntPtr notify);
    [PreserveSig] int UnregisterControlChangeNotify(IntPtr notify);
    [PreserveSig] int GetChannelCount(out int count);
    [PreserveSig] int SetMasterVolumeLevel(float levelDB, ref Guid ctx);
    [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid ctx);
    [PreserveSig] int GetMasterVolumeLevel(out float levelDB);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
    [PreserveSig] int SetChannelVolumeLevel(uint channel, float levelDB, ref Guid ctx);
    [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float level, ref Guid ctx);
    [PreserveSig] int GetChannelVolumeLevel(uint channel, out float levelDB);
    [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float level);
    [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
    [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
  }

  [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionManager2 {
    [PreserveSig] int GetAudioSessionControl(IntPtr guid, int flags, out IntPtr control);
    [PreserveSig] int GetSimpleAudioVolume(IntPtr guid, int flags, out IntPtr volume);
    [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessions);
  }

  [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionEnumerator {
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int GetSession(int index, out IAudioSessionControl2 session);
  }

  [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl2 {
    [PreserveSig] int GetState(out int state);
    [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid ctx);
    [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
    [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid ctx);
    [PreserveSig] int GetGroupingParam(out Guid param);
    [PreserveSig] int SetGroupingParam(ref Guid param, ref Guid ctx);
    [PreserveSig] int RegisterAudioSessionNotification(IntPtr notify);
    [PreserveSig] int UnregisterAudioSessionNotification(IntPtr notify);
    [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
    [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
    [PreserveSig] int GetProcessId(out uint pid);
    [PreserveSig] int IsSystemSoundsSession();
    [PreserveSig] int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool optOut);
  }

  [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface ISimpleAudioVolume {
    [PreserveSig] int SetMasterVolume(float level, ref Guid ctx);
    [PreserveSig] int GetMasterVolume(out float level);
    [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
    [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
  }

  public static class Api {
    const int CLSCTX_ALL = 23;
    const int E_RENDER = 0, E_CAPTURE = 1, E_MULTIMEDIA = 1, E_COMMUNICATIONS = 2;
    static Guid IID_EndpointVolume = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
    static Guid IID_SessionManager2 = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");
    static Guid Ctx = Guid.Empty;

    [DllImport("user32.dll")]
    static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

    static string Esc(string s) {
      if (s == null) return "";
      var sb = new StringBuilder();
      foreach (char c in s) {
        if (c == '"' || c == '\\') { sb.Append('\\'); sb.Append(c); }
        else if (c < 32) sb.Append(string.Format("\\u{0:x4}", (int)c));
        else sb.Append(c);
      }
      return sb.ToString();
    }

    static IMMDevice Device(int flow, int role) {
      var e = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
      IMMDevice dev;
      if (e.GetDefaultAudioEndpoint(flow, role, out dev) != 0) return null;
      return dev;
    }

    static IAudioEndpointVolume Endpoint(int flow, int role) {
      var dev = Device(flow, role);
      if (dev == null) return null;
      object o;
      if (dev.Activate(ref IID_EndpointVolume, CLSCTX_ALL, IntPtr.Zero, out o) != 0) return null;
      return (IAudioEndpointVolume)o;
    }

    class Session { public uint Pid; public string Name; public string Desc; public float Vol; public bool Mute; public int State; public ISimpleAudioVolume V; }

    static List<Session> Sessions() {
      var list = new List<Session>();
      var dev = Device(E_RENDER, E_MULTIMEDIA);
      if (dev == null) return list;
      object o;
      if (dev.Activate(ref IID_SessionManager2, CLSCTX_ALL, IntPtr.Zero, out o) != 0) return list;
      var mgr = (IAudioSessionManager2)o;
      IAudioSessionEnumerator en;
      if (mgr.GetSessionEnumerator(out en) != 0) return list;
      int count; en.GetCount(out count);
      for (int i = 0; i < count; i++) {
        IAudioSessionControl2 ctl;
        if (en.GetSession(i, out ctl) != 0 || ctl == null) continue;
        int state; ctl.GetState(out state);
        if (state == 2) continue; // expired
        var s = new Session { State = state };
        ctl.GetProcessId(out s.Pid);
        if (ctl.IsSystemSoundsSession() == 0) { s.Name = "system"; s.Desc = "System sounds"; }
        else {
          try {
            var p = Process.GetProcessById((int)s.Pid);
            s.Name = p.ProcessName.ToLowerInvariant();
            try { s.Desc = p.MainModule.FileVersionInfo.FileDescription; } catch {}
            if (string.IsNullOrEmpty(s.Desc)) s.Desc = p.ProcessName;
          } catch { continue; }
        }
        s.V = ctl as ISimpleAudioVolume;
        if (s.V == null) continue;
        s.V.GetMasterVolume(out s.Vol);
        s.V.GetMute(out s.Mute);
        list.Add(s);
      }
      return list;
    }

    static string List() {
      var sb = new StringBuilder("{");
      var ep = Endpoint(E_RENDER, E_MULTIMEDIA);
      if (ep != null) {
        float v; bool m; ep.GetMasterVolumeLevelScalar(out v); ep.GetMute(out m);
        sb.AppendFormat("\"master\":{{\"volume\":{0},\"muted\":{1}}},", (int)Math.Round(v * 100), m ? "true" : "false");
      }
      var mic = Endpoint(E_CAPTURE, E_COMMUNICATIONS);
      if (mic != null) {
        bool mm; mic.GetMute(out mm);
        sb.AppendFormat("\"mic\":{{\"muted\":{0}}},", mm ? "true" : "false");
      }
      sb.Append("\"sessions\":[");
      bool first = true;
      foreach (var s in Sessions()) {
        if (!first) sb.Append(",");
        first = false;
        sb.AppendFormat("{{\"pid\":{0},\"name\":\"{1}\",\"desc\":\"{2}\",\"volume\":{3},\"muted\":{4},\"active\":{5}}}",
          s.Pid, Esc(s.Name), Esc(s.Desc), (int)Math.Round(s.Vol * 100), s.Mute ? "true" : "false", s.State == 1 ? "true" : "false");
      }
      sb.Append("]}");
      return sb.ToString();
    }

    static string SetVolume(string target, int level) {
      float f = Math.Max(0, Math.Min(100, level)) / 100f;
      if (target == "master") {
        var ep = Endpoint(E_RENDER, E_MULTIMEDIA);
        if (ep == null) return "{\"ok\":false}";
        ep.SetMasterVolumeLevelScalar(f, ref Ctx);
        if (f > 0) ep.SetMute(false, ref Ctx);
        return "{\"ok\":true}";
      }
      foreach (var s in Sessions()) if (s.Name == target) {
        s.V.SetMasterVolume(f, ref Ctx);
        if (f > 0 && s.Mute) s.V.SetMute(false, ref Ctx);
      }
      return "{\"ok\":true}";
    }

    // mode: "1" mute, "0" unmute, "t" toggle
    static string SetMute(string target, string mode) {
      if (target == "master" || target == "mic") {
        var ep = target == "mic" ? Endpoint(E_CAPTURE, E_COMMUNICATIONS) : Endpoint(E_RENDER, E_MULTIMEDIA);
        if (ep == null) return "{\"ok\":false}";
        bool cur; ep.GetMute(out cur);
        bool next = mode == "t" ? !cur : mode == "1";
        ep.SetMute(next, ref Ctx);
        return "{\"ok\":true,\"muted\":" + (next ? "true" : "false") + "}";
      }
      bool? result = null;
      foreach (var s in Sessions()) if (s.Name == target) {
        bool next = mode == "t" ? !s.Mute : mode == "1";
        s.V.SetMute(next, ref Ctx);
        result = next;
      }
      return "{\"ok\":" + (result.HasValue ? "true" : "false") + ",\"muted\":" + (result == true ? "true" : "false") + "}";
    }

    static string Icon(uint pid) {
      try {
        var path = Process.GetProcessById((int)pid).MainModule.FileName;
        using (var icon = System.Drawing.Icon.ExtractAssociatedIcon(path))
        using (var bmp = new Bitmap(icon.ToBitmap(), new Size(48, 48)))
        using (var ms = new MemoryStream()) {
          bmp.Save(ms, ImageFormat.Png);
          return "{\"icon\":\"data:image/png;base64," + Convert.ToBase64String(ms.ToArray()) + "\"}";
        }
      } catch { return "{\"icon\":null}"; }
    }

    static readonly HashSet<byte> Extended = new HashSet<byte> {
      0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x2D,0x2E,0x5B,0x5C,0xA3,0xA5,
      0xAD,0xAE,0xAF,0xB0,0xB1,0xB2,0xB3
    };

    static string Keys(string csv) {
      var codes = new List<byte>();
      foreach (var part in csv.Split(',')) { byte b; if (byte.TryParse(part.Trim(), out b)) codes.Add(b); }
      foreach (var k in codes) keybd_event(k, 0, Extended.Contains(k) ? 1u : 0u, UIntPtr.Zero);
      Thread.Sleep(30);
      for (int i = codes.Count - 1; i >= 0; i--)
        keybd_event(codes[i], 0, (Extended.Contains(codes[i]) ? 1u : 0u) | 2u, UIntPtr.Zero);
      return "{\"ok\":true}";
    }

    public static string Handle(string line) {
      try {
        var parts = line.Split(new[] { ' ' }, 3);
        switch (parts[0]) {
          case "list": return List();
          case "volume": return SetVolume(parts[1], int.Parse(parts[2]));
          case "mute": return SetMute(parts[1], parts[2]);
          case "icon": return Icon(uint.Parse(parts[1]));
          case "keys": return Keys(parts[1]);
          case "ping": return "{\"ok\":true}";
          default: return "{\"error\":\"unknown command\"}";
        }
      } catch (Exception ex) {
        return "{\"error\":\"" + Esc(ex.Message) + "\"}";
      }
    }
  }
}
`

const SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$source = @'
${CSHARP}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing
[Console]::Out.WriteLine('ready')
[Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $sep = $line.IndexOf('|')
  if ($sep -lt 0) { continue }
  $id = $line.Substring(0, $sep)
  $res = [GlanceThingPlus.Api]::Handle($line.Substring($sep + 1))
  [Console]::Out.WriteLine($id + '|' + $res)
  [Console]::Out.Flush()
}
`

type Pending = { resolve: (v: unknown) => void; timer: NodeJS.Timeout }

class WindowsHelper {
  private proc: ChildProcessWithoutNullStreams | null = null
  private ready: Promise<boolean> | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1
  private buffer = ''

  get supported() {
    return process.platform === 'win32'
  }

  private start(): Promise<boolean> {
    if (this.ready) return this.ready
    if (!this.supported) return Promise.resolve(false)

    this.ready = new Promise<boolean>(resolve => {
      const scriptPath = path.join(app.getPath('userData'), 'gtp-helper.ps1')
      fs.writeFileSync(scriptPath, SCRIPT, 'utf8')

      const proc = spawn(
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath
        ],
        { windowsHide: true }
      )
      this.proc = proc

      const startTimer = setTimeout(() => {
        log('Helper did not start in time', 'WindowsHelper', LogLevel.ERROR)
        resolve(false)
      }, 20000)

      proc.stdout.setEncoding('utf8')
      proc.stdout.on('data', (chunk: string) => {
        this.buffer += chunk
        let idx: number
        while ((idx = this.buffer.indexOf('\n')) >= 0) {
          const line = this.buffer.slice(0, idx).trim()
          this.buffer = this.buffer.slice(idx + 1)
          if (line === 'ready') {
            clearTimeout(startTimer)
            log('Helper ready', 'WindowsHelper')
            resolve(true)
            continue
          }
          const sep = line.indexOf('|')
          if (sep < 0) continue
          const id = Number(line.slice(0, sep))
          const p = this.pending.get(id)
          if (!p) continue
          this.pending.delete(id)
          clearTimeout(p.timer)
          try {
            p.resolve(JSON.parse(line.slice(sep + 1)))
          } catch {
            p.resolve(null)
          }
        }
      })

      proc.stderr.setEncoding('utf8')
      proc.stderr.on('data', (d: string) =>
        log(`stderr: ${d.trim()}`, 'WindowsHelper', LogLevel.WARN)
      )

      proc.on('exit', code => {
        log(`Helper exited (${code})`, 'WindowsHelper', LogLevel.WARN)
        clearTimeout(startTimer)
        resolve(false)
        this.proc = null
        this.ready = null
        for (const p of this.pending.values()) {
          clearTimeout(p.timer)
          p.resolve(null)
        }
        this.pending.clear()
      })
    })

    return this.ready
  }

  async call<T = unknown>(command: string): Promise<T | null> {
    if (!(await this.start()) || !this.proc) return null
    const id = this.nextId++
    return new Promise<T | null>(resolve => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolve(null)
      }, 5000)
      this.pending.set(id, {
        resolve: v => resolve(v as T),
        timer
      })
      this.proc!.stdin.write(`${id}|${command.replace(/[\r\n]/g, ' ')}\n`)
    })
  }

  stop() {
    this.proc?.kill()
    this.proc = null
    this.ready = null
  }
}

export const windowsHelper = new WindowsHelper()

const VK: Record<string, number> = {
  ctrl: 0x11, control: 0x11, shift: 0x10, alt: 0x12, win: 0x5b, meta: 0x5b,
  enter: 0x0d, return: 0x0d, esc: 0x1b, escape: 0x1b, space: 0x20, tab: 0x09,
  backspace: 0x08, delete: 0x2e, del: 0x2e, insert: 0x2d, home: 0x24,
  end: 0x23, pageup: 0x21, pagedown: 0x22, up: 0x26, down: 0x28,
  left: 0x25, right: 0x27, printscreen: 0x2c, capslock: 0x14,
  playpause: 0xb3, play: 0xb3, nexttrack: 0xb0, next: 0xb0, prevtrack: 0xb1,
  previous: 0xb1, prev: 0xb1, stop: 0xb2, volumeup: 0xaf, volumedown: 0xae,
  volumemute: 0xad, mute: 0xad,
  ';': 0xba, '=': 0xbb, ',': 0xbc, '-': 0xbd, '.': 0xbe, '/': 0xbf,
  '`': 0xc0, '[': 0xdb, '\\': 0xdc, ']': 0xdd, "'": 0xde
}

/** Parse "ctrl+shift+m" into Windows virtual-key codes. Returns null if invalid. */
export function parseKeys(combo: string): number[] | null {
  const codes: number[] = []
  for (const raw of combo.toLowerCase().split('+')) {
    const key = raw.trim()
    if (!key) return null
    if (VK[key] !== undefined) codes.push(VK[key])
    else if (/^[a-z]$/.test(key)) codes.push(key.toUpperCase().charCodeAt(0))
    else if (/^[0-9]$/.test(key)) codes.push(key.charCodeAt(0))
    else if (/^f([1-9]|1[0-9]|2[0-4])$/.test(key))
      codes.push(0x6f + parseInt(key.slice(1)))
    else return null
  }
  return codes
}

export async function sendKeys(combo: string): Promise<boolean> {
  const codes = parseKeys(combo)
  if (!codes) {
    log(`Invalid key combination: ${combo}`, 'Keys', LogLevel.WARN)
    return false
  }
  if (!windowsHelper.supported) {
    log('Sending keys is only supported on Windows', 'Keys', LogLevel.WARN)
    return false
  }
  const res = await windowsHelper.call<{ ok: boolean }>(`keys ${codes.join(',')}`)
  return Boolean(res?.ok)
}
