import { tool } from "@langchain/core/tools"
import { z } from "zod"

import { truncateString } from "../shared/formatting"

/**
 * Sends an HTTP request and returns status, headers, text, and parsed JSON when possible.
 */
export const httpRequestTool = tool(
  async ({ url, method, headers, body, timeoutMs }) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs ?? 20000, 60000))
    try {
      const res = await fetch(url, {
        method: method ?? "GET",
        headers: headers ?? {},
        body: body ?? undefined,
        signal: controller.signal,
      })
      const rawText = await res.text().catch(() => "")
      let json: unknown = null
      try {
        json = JSON.parse(rawText)
      } catch {
        json = null
      }
      return {
        type: "http_request",
        url,
        method: method ?? "GET",
        status: res.status,
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries()),
        bodyText: truncateString(rawText, 6000),
        json,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed"
      return {
        type: "http_request",
        url,
        method: method ?? "GET",
        error: message,
      }
    } finally {
      clearTimeout(timer)
    }
  },
  {
    name: "http_request",
    description: "Make an HTTP request (for APIs or fetching raw content).",
    schema: z.object({
      url: z.string().url(),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional(),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
    }),
  }
)

/**
 * Fetches a small binary resource and returns it as base64 for follow-up processing.
 */
export const downloadFetchTool = tool(
  async ({ url, headers, timeoutMs }) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs ?? 20000, 60000))
    try {
      const res = await fetch(url, { headers: headers ?? {}, signal: controller.signal })
      const arrayBuffer = await res.arrayBuffer()
      const buf = Buffer.from(arrayBuffer)
      const sizeLimit = 5 * 1024 * 1024
      if (buf.length > sizeLimit) {
        return {
          type: "download_fetch",
          url,
          status: res.status,
          ok: res.ok,
          size: buf.length,
          contentType: res.headers.get("content-type") || "",
          error: `File too large (${buf.length} bytes, limit ${sizeLimit})`,
        }
      }
      return {
        type: "download_fetch",
        url,
        status: res.status,
        ok: res.ok,
        size: buf.length,
        contentType: res.headers.get("content-type") || "",
        base64: buf.toString("base64"),
      }
    } catch (err) {
      return {
        type: "download_fetch",
        url,
        error: err instanceof Error ? err.message : "Download failed",
      }
    } finally {
      clearTimeout(timer)
    }
  },
  {
    name: "download_fetch",
    description: "Fetch a binary file and return base64 (max ~5MB).",
    schema: z.object({
      url: z.string().url(),
      headers: z.record(z.string(), z.string()).optional(),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
    }),
  }
)

export const fetchManyTool = tool(
  async ({ urls, timeoutMs }) => {
    const limit = Math.min(urls.length, 10)
    const results = await Promise.all(
      urls.slice(0, limit).map(async (url) => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs ?? 15000)
        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "Rekdin/NextJS" },
          })
          const text = await res.text().catch(() => "")
          return {
            url,
            status: res.status,
            ok: res.ok,
            contentType: res.headers.get("content-type"),
            textPreview: truncateString(text, 2000),
          }
        } catch (err) {
          return { url, error: err instanceof Error ? err.message : "Fetch failed" }
        } finally {
          clearTimeout(timer)
        }
      })
    )
    return { type: "fetch_many", results, omittedUrls: Math.max(urls.length - limit, 0) }
  },
  {
    name: "fetch_many",
    description: "Fetch up to 10 URLs and return compact text previews.",
    schema: z.object({
      urls: z.array(z.string().url()).min(1).max(25),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
    }),
  }
)

export const domainInfoTool = tool(
  async ({ domain }) => {
    const dns = await import("dns/promises")
    const [addresses, mx, txt] = await Promise.all([
      dns.resolve4(domain).catch(() => []),
      dns.resolveMx(domain).catch(() => []),
      dns.resolveTxt(domain).catch(() => []),
    ])
    return { type: "domain_info", domain, addresses, mx, txt: txt.slice(0, 20) }
  },
  {
    name: "domain_info",
    description: "Resolve basic DNS information for a domain.",
    schema: z.object({ domain: z.string().min(1) }),
  }
)

export const dnsLookupTool = tool(
  async ({ hostname, types }: { hostname: string; types?: string[] }) => {
    const dns = await import("dns/promises")
    const selectedTypes = types ?? ["A", "AAAA", "MX", "TXT", "CNAME", "NS"]
    const records: Record<string, unknown> = {}
    await Promise.all(
      selectedTypes.map(async (t) => {
        try {
          switch (t.toUpperCase()) {
            case "A":
              records.A = await dns.resolve4(hostname)
              break
            case "AAAA":
              records.AAAA = await dns.resolve6(hostname)
              break
            case "MX":
              records.MX = await dns.resolveMx(hostname)
              break
            case "TXT":
              records.TXT = (await dns.resolveTxt(hostname)).map((r) => r.join(""))
              break
            case "CNAME":
              records.CNAME = await dns.resolveCname(hostname)
              break
            case "NS":
              records.NS = await dns.resolveNs(hostname)
              break
            case "SOA":
              records.SOA = await dns.resolveSoa(hostname)
              break
          }
        } catch {
          // Skip unavailable record types
        }
      })
    )
    return {
      type: "dns_lookup",
      hostname,
      records,
      resolvedTypes: Object.keys(records),
    }
  },
  {
    name: "dns_lookup",
    description: "Resolve DNS records (A, AAAA, MX, TXT, CNAME, NS) for a hostname.",
    schema: z.object({
      hostname: z.string().min(1),
      types: z.array(z.string()).optional(),
    }),
  }
)

export const sslCheckTool = tool(
  async ({ hostname, port = 443 }: { hostname: string; port?: number }) => {
    const tls = await import("tls")
    const cert = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const socket = tls.connect(
        { host: hostname, port, servername: hostname, rejectUnauthorized: false },
        () => {
          const peerCert = socket.getPeerCertificate(true)
          socket.destroy()
          if (!peerCert || !peerCert.subject) {
            reject(new Error("No certificate returned"))
            return
          }
          const valid = socket.authorized
          resolve({
            subject: peerCert.subject,
            issuer: peerCert.issuer,
            validFrom: peerCert.valid_from,
            validTo: peerCert.valid_to,
            serialNumber: peerCert.serialNumber,
            fingerprint: peerCert.fingerprint,
            subjectAltNames: (peerCert.subjectaltname ?? "").split(", ").filter(Boolean),
            authorized: valid,
          })
        }
      )
      socket.on("error", reject)
      socket.setTimeout(10000, () => {
        socket.destroy()
        reject(new Error("Timeout"))
      })
    }).catch((err) => ({ error: err instanceof Error ? err.message : String(err) }))

    if ("error" in cert) {
      return { type: "ssl_check", hostname, port, ...cert }
    }

    const expiry = new Date((cert.validTo as string) ?? "")
    const now = new Date()
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return {
      type: "ssl_check",
      hostname,
      port,
      ...cert,
      expiresAt: cert.validTo,
      daysUntilExpiry,
      expired: daysUntilExpiry < 0,
      expiringSoon: daysUntilExpiry >= 0 && daysUntilExpiry < 30,
    }
  },
  {
    name: "ssl_check",
    description:
      "Check the SSL/TLS certificate for a hostname — issuer, subject, expiry, SANs, and validity.",
    schema: z.object({
      hostname: z.string().min(1),
      port: z.number().int().min(1).max(65535).optional(),
    }),
  }
)

export const pingTool = tool(
  async ({ host, count = 3 }: { host: string; count?: number }) => {
    const { runCommandUnsafe } = await import("../shared/command")
    const os = await import("os")
    const platform = os.platform()
    const n = Math.min(Math.max(count, 1), 10)
    const cmd = platform === "win32" ? `ping -n ${n} ${host}` : `ping -c ${n} ${host}`
    const result = await runCommandUnsafe(cmd, undefined, 15000).catch((err) => ({
      stdout: "",
      stderr: String(err),
      exitCode: 1,
      duration: 0,
    }))
    const lines = result.stdout
    const rttLine =
      lines.match(/round-trip[^=]+=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/) ??
      lines.match(/rtt[^=]+=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/) ??
      lines.match(/Minimum = ([\d]+)ms, Maximum = ([\d]+)ms, Average = ([\d]+)ms/)
    const stats = rttLine
      ? {
          minMs: parseFloat(rttLine[1]),
          avgMs: parseFloat(rttLine[2]),
          maxMs: parseFloat(rttLine[3]),
        }
      : undefined
    const transmitted = lines.match(/(\d+) packets transmitted/)
    const received = lines.match(/(\d+) (?:packets )?received/)
    return {
      type: "ping",
      host,
      count: n,
      reachable: result.exitCode === 0,
      transmitted: transmitted ? parseInt(transmitted[1]) : n,
      received: received ? parseInt(received[1]) : result.exitCode === 0 ? n : 0,
      stats,
      output: truncateString(result.stdout, 1000),
    }
  },
  {
    name: "ping",
    description: "Check host reachability and measure round-trip latency.",
    schema: z.object({
      host: z.string().min(1),
      count: z.number().int().min(1).max(10).optional(),
    }),
  }
)

export const whoisLookupTool = tool(
  async ({ domain }: { domain: string }) => {
    const cleanDomain = domain
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .toLowerCase()
    const res = await fetch(`https://rdap.org/domain/${cleanDomain}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return {
        type: "whois_lookup",
        domain: cleanDomain,
        error: `RDAP lookup failed: ${res.status}`,
      }
    }
    const data = (await res.json()) as Record<string, unknown>
    const events = Array.isArray(data.events)
      ? (data.events as Array<Record<string, unknown>>).reduce(
          (acc, e) => {
            if (typeof e.eventAction === "string" && typeof e.eventDate === "string") {
              acc[e.eventAction] = e.eventDate
            }
            return acc
          },
          {} as Record<string, string>
        )
      : {}
    const nameservers = Array.isArray(data.nameservers)
      ? (data.nameservers as Array<Record<string, unknown>>).map((ns) => String(ns.ldhName ?? ""))
      : []
    const entities = Array.isArray(data.entities)
      ? (data.entities as Array<Record<string, unknown>>)
      : []
    const registrar = entities.find(
      (e) => Array.isArray(e.roles) && (e.roles as string[]).includes("registrar")
    )
    const vcardFields = (registrar?.vcardArray as Array<unknown[]>)?.[1] ?? []
    const fnField = vcardFields.find((v): v is unknown[] => Array.isArray(v) && v[0] === "fn")
    const registrarName = fnField ? fnField[3] : undefined
    return {
      type: "whois_lookup",
      domain: cleanDomain,
      status: Array.isArray(data.status) ? data.status : undefined,
      nameservers,
      registrar: typeof registrarName === "string" ? registrarName : undefined,
      events,
      registered: events["registration"],
      updated: events["last changed"],
      expires: events["expiration"],
    }
  },
  {
    name: "whois_lookup",
    description:
      "WHOIS/RDAP data for a domain — registrar, nameservers, registration, and expiry dates.",
    schema: z.object({ domain: z.string().min(1) }),
  }
)
