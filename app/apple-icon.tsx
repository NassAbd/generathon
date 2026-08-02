import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — matches the green clapperboard studio mark. */
export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1A1C24",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(61, 255, 138, 0.12)",
            borderRadius: 28,
          }}
        >
          <div
            style={{
              width: 88,
              height: 72,
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                width: 88,
                height: 22,
                background: "#3DFF8A",
                borderRadius: "10px 10px 0 0",
                transform: "skewX(-12deg)",
                marginLeft: 4,
              }}
            />
            <div
              style={{
                width: 88,
                height: 50,
                background: "#3DFF8A",
                borderRadius: "0 0 12px 12px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                paddingLeft: 14,
                gap: 8,
              }}
            >
              <div style={{ width: 52, height: 8, background: "#142018", borderRadius: 4, opacity: 0.55 }} />
              <div style={{ width: 36, height: 8, background: "#142018", borderRadius: 4, opacity: 0.35 }} />
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
