import * as React from "react"

import { Rekdin as RekdinIcon } from "@/lib/icons"

import { siteConfig } from "./site-config"

function SocialLogo() {
  return (
    <div
      style={{
        display: "flex",
        width: 236,
        height: 236,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 64,
        color: "#F5F5F4",
        background: "linear-gradient(135deg, #141417 0%, #101115 55%, #040507 100%)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <RekdinIcon width={192} height={192} />
    </div>
  )
}

export function SocialImageTemplate() {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background:
          "radial-gradient(circle at top right, rgba(94, 132, 255, 0.22), transparent 32%), radial-gradient(circle at bottom left, rgba(125, 211, 252, 0.14), transparent 28%), linear-gradient(135deg, #0A0B0D 0%, #101117 48%, #060709 100%)",
        color: "#F7F7F5",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 24,
          borderRadius: 32,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -80,
          top: -120,
          width: 360,
          height: 360,
          borderRadius: 999,
          background: "rgba(94, 132, 255, 0.12)",
        }}
      />
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
          justifyContent: "space-between",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            maxWidth: 760,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 86,
                  height: 86,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <RekdinIcon width={48} height={48} style={{ color: "#F5F5F4" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#A9C3FF",
                  }}
                >
                  Research and Automation
                </div>
                <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
                  {siteConfig.name}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                fontSize: 64,
                lineHeight: 1.04,
                letterSpacing: "-0.04em",
                fontWeight: 800,
              }}
            >
              <div style={{ display: "flex" }}>Run web research,</div>
              <div style={{ display: "flex" }}>browser actions, and</div>
              <div style={{ display: "flex", color: "#A9C3FF" }}>workspace automation.</div>
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 720,
                fontSize: 26,
                lineHeight: 1.42,
                color: "#D2D6E1",
              }}
            >
              {siteConfig.description}
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {["LangChain", "OpenRouter", "Browser tools", "Artifacts", "Live traces"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 20px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#F7F7F5",
                    fontSize: 20,
                    fontWeight: 600,
                  }}
                >
                  {label}
                </div>
              )
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 320,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 300,
              height: 300,
              borderRadius: 999,
              background: "rgba(94, 132, 255, 0.14)",
            }}
          />
          <div
            style={{
              display: "flex",
              width: 260,
              height: 260,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SocialLogo />
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 8,
          background: "linear-gradient(90deg, #DCE4FF 0%, #A9C3FF 50%, #708DFF 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 42,
          bottom: 24,
          display: "flex",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#A9C3FF",
        }}
      >
        {siteConfig.shortName}
      </div>
    </div>
  )
}
