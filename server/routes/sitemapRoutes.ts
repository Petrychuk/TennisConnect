import { Router } from "express";
import { db } from "../db";
import {
  articles,
  travelPackages,
  recreationServices,
  tournaments,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const baseUrl = "https://www.tennisconnect.com.au";

    // Static pages
    const staticPages = [
      "",
      "/players",
      "/coaches",
      "/clubs",
      "/tournaments",
      "/travels",
      "/recreation",
      "/marketplace",
      "/articles",
    ];

    const staticUrls = staticPages
      .map(
        (url) => `
  <url>
    <loc>${baseUrl}${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>${url === "" ? "1.0" : "0.8"}</priority>
  </url>`
      )
      .join("");

    // Published Articles
    const publishedArticles = await db
      .select()
      .from(articles)
      .where(eq(articles.isPublished, true));

    const articleUrls = publishedArticles
      .map(
        (article) => `
  <url>
    <loc>${baseUrl}/articles/${article.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>${
      article.category === "Legal" ? "0.4" : "0.7"
    }</priority>
  </url>`
      )
      .join("");

    // Active Travel Packages
    const travelItems = await db
      .select()
      .from(travelPackages)
      .where(eq(travelPackages.isActive, true));

    const travelUrls = travelItems
      .map(
        (item) => `
  <url>
    <loc>${baseUrl}/travels/${item.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
      )
      .join("");

    // Active Recreation Services
    const recreationItems = await db
      .select()
      .from(recreationServices)
      .where(eq(recreationServices.isActive, true));

    const recreationUrls = recreationItems
      .map(
        (item) => `
  <url>
    <loc>${baseUrl}/recreation/${item.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
      )
      .join("");

    // Tournaments
    const tournamentItems = await db
      .select()
      .from(tournaments);

    const tournamentUrls = tournamentItems
      .map(
        (item) => `
  <url>
    <loc>${baseUrl}/event-tournaments/${item.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
      )
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${articleUrls}
${travelUrls}
${recreationUrls}
${tournamentUrls}
</urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.status(200).send(xml);

  } catch (error) {
    console.error("Sitemap generation failed:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

export default router;