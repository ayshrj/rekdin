import { ImageResponse } from "next/og"

import { siteConfig } from "./site-config"

export const alt = `${siteConfig.name} preview`
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

function BrandMark() {
  return (
    <svg width="128" height="128" viewBox="0 0 24 24" fill="none">
      <path
        fill="#F5F5F4"
        d="M17.543 4.896c.867 1.313 1.722 2.609 2.582 3.902.097.147.129.273.024.433-1.073 1.632-2.141 3.266-3.212 4.899-.035.053-.085.096-.178.199-2.815-4.238-5.574-8.475-8.305-12.706.06-.157.18-.148.272-.165 1.853-.346 3.708-.681 5.56-1.036.263-.05.387.043.516.243.906 1.408 1.819 2.81 2.741 4.232Zm-2.613 3.869c.6.914 1.2 1.828 1.816 2.765.063-.078.101-.117.13-.161.45-.683.886-1.375 1.353-2.046.167-.24.15-.414-.001-.643-1.401-2.125-2.796-4.255-4.186-6.387-.121-.186-.251-.232-.465-.187-.645.135-1.296.243-1.942.376-.212.044-.441.042-.666.191 1.318 2.027 2.628 4.043 3.961 6.092Z"
      />
      <path
        fill="#F5F5F4"
        d="M9.032 13.047c-1.569 3.235-3.13 6.451-4.68 9.647-.164.002-.216-.084-.278-.148C2.768 21.182 1.466 19.815.155 18.457c-.15-.156-.155-.279-.064-.464C1.468 15.199 2.843 12.405 4.206 9.604c.133-.273.29-.369.595-.367 1.888.015 3.776.008 5.664.009.11 0 .223-.017.391.059-.607 1.245-1.21 2.484-1.824 3.741ZM2.236 17.16c-.084.176-.16.356-.255.526-.104.187-.093.327.068.489.381.381.739.785 1.108 1.177.227.241.457.479.719.753 1.557-3.103 3.017-6.196 4.51-9.273-.138-.081-.251-.056-.359-.056-.771-.001-1.543.015-2.314-.003-.276-.006-.415.095-.531.334-.97 2.007-1.951 4.009-2.945 6.051Z"
      />
      <path
        fill="#F5F5F4"
        d="M18.363 16.9c1.757 0 3.487-.001 5.217 0 .376 0 .393.021.27.382-.599 1.759-1.203 3.516-1.798 5.276-.071.209-.182.286-.405.286-2.994-.006-5.989-.006-8.983-.002-.2 0-.321-.062-.411-.252-.842-1.771-1.705-3.532-2.51-5.32-.044-.098-.111-.194-.091-.37 2.893 0 5.788 0 8.711 0Zm2.645 3.917c.257-.763.514-1.526.777-2.308h-9.714c-.015.122.03.195.065.269.353.748.715 1.492 1.057 2.245.1.219.232.291.47.29 2.241-.009 4.482-.004 6.724-.009.48-.001.433.097.621-.487Z"
      />
    </svg>
  )
}

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(circle at top left, rgba(96,165,250,0.18), transparent 28%), linear-gradient(135deg, #09090b 0%, #111114 45%, #050506 100%)",
        color: "#f5f5f4",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 24,
          borderRadius: 32,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        }}
      />
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "72px",
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
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                display: "flex",
                width: 86,
                height: 86,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <BrandMark />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, letterSpacing: 4, opacity: 0.72 }}>REKDIN</div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>
                AI Research and Automation Workspace
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ fontSize: 72, lineHeight: 1.03, fontWeight: 800 }}>
              Research, browse, automate, and ship from one workspace.
            </div>
            <div style={{ fontSize: 28, lineHeight: 1.35, color: "rgba(245,245,244,0.76)" }}>
              Run web research, browser actions, file workflows, and tool-driven AI tasks with live
              traces.
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            width: 250,
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "stretch",
          }}
        >
          {["Web research", "Browser actions", "Workspace edits", "Execution traces"].map(
            (label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 24,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  padding: "22px 18px",
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    size
  )
}
