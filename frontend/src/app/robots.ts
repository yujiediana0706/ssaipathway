import type { MetadataRoute } from "next";

const BASE = "https://yourpathwayai.com";

export default function robots(): MetadataRoute.Robots {
  // 只放行公开页面；登录后的工作台、教练后台、API 不收录
  const privatePaths = [
    "/api/",
    "/admin",
    "/coach",
    "/dashboard",
    "/my-bookings",
    "/resume-optimize",
    "/become-coach",
    "/payment",
    "/auth/",
  ];
  const disallow = privatePaths.flatMap((p) => [`/zh${p}`, `/en${p}`]);

  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
