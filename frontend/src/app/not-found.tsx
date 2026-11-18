export default function NotFound() {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F9FCFE",
          color: "#0B3182",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        }}
      >
        <main style={{ textAlign: "center", padding: "0 24px", maxWidth: 520 }}>
          <p
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#2662D0",
              margin: 0,
            }}
          >
            404
          </p>
          <h1 style={{ fontSize: 22, margin: "8px 0 0" }}>这个页面走丢了</h1>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "#5B6B85", margin: "10px 0 0" }}>
            This page could not be found.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 28,
            }}
          >
            <a
              href="/zh"
              style={{
                display: "inline-block",
                background: "#2662D0",
                color: "#fff",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                padding: "12px 22px",
                borderRadius: 999,
              }}
            >
              返回首页
            </a>
            <a
              href="/zh/onboarding"
              style={{
                display: "inline-block",
                border: "1px solid #2662D0",
                color: "#2662D0",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                padding: "12px 22px",
                borderRadius: 999,
                background: "#fff",
              }}
            >
              开始职业探索
            </a>
          </div>
          <p style={{ fontSize: 12, marginTop: 26, color: "#8A99B3" }}>
            <a href="/en" style={{ color: "#2662D0" }}>
              English version
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
