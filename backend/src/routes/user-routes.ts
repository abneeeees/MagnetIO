import { Hono } from "hono";
import { requireAuth, type AuthUser, type AuthEnv } from "../middleware/auth";
import { prisma } from "../db/prisma";

export const userRoutes = new Hono<AuthEnv>();

// Apply auth middleware to all /user routes
userRoutes.use("*", requireAuth);

// GET /user/profile
userRoutes.get("/profile", async (c) => {
  const user = c.get("user") as AuthUser;
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { settings: true },
    });
    return c.json({ user: dbUser || user });
  } catch {
    return c.json({ user });
  }
});

// GET /user/history
userRoutes.get("/history", async (c) => {
  const user = c.get("user") as AuthUser;
  try {
    const history = await prisma.watchHistory.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return c.json({ history });
  } catch {
    return c.json({ error: "Failed to fetch watch history" }, 500);
  }
});

// POST /user/history
userRoutes.post("/history", async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json();

  const {
    mediaId,
    title,
    mediaType = "movie",
    seasonNum = null,
    episodeNum = null,
    currentTime = 0,
    duration = 0,
    completed = false,
    posterUrl = null,
  } = body;

  if (!mediaId || !title) {
    return c.json({ error: "mediaId and title are required" }, 400);
  }

  try {
    const normalizedSeason = seasonNum !== null ? Number(seasonNum) : null;
    const normalizedEpisode = episodeNum !== null ? Number(episodeNum) : null;
    const progress = {
      currentTime: Number(currentTime),
      duration: Number(duration),
      completed: Boolean(completed),
      posterUrl,
      title,
    };
    const existing = await prisma.watchHistory.findFirst({
      where: {
        userId: user.id,
        mediaId: String(mediaId),
        seasonNum: normalizedSeason,
        episodeNum: normalizedEpisode,
      },
    });
    const entry = existing
      ? await prisma.watchHistory.update({
          where: { id: existing.id },
          data: { ...progress, updatedAt: new Date() },
        })
      : await prisma.watchHistory.create({
          data: {
            userId: user.id,
            mediaId: String(mediaId),
            ...progress,
            mediaType,
            seasonNum: normalizedSeason,
            episodeNum: normalizedEpisode,
          },
        });

    return c.json({ success: true, entry });
  } catch (err) {
    console.error("Error saving watch history:", err);
    return c.json({ error: "Failed to save watch progress" }, 500);
  }
});

// GET /user/watchlist
userRoutes.get("/watchlist", async (c) => {
  const user = c.get("user") as AuthUser;
  try {
    const watchlist = await prisma.watchlist.findMany({
      where: { userId: user.id },
      orderBy: { addedAt: "desc" },
    });
    return c.json({ watchlist });
  } catch {
    return c.json({ error: "Failed to fetch watchlist" }, 500);
  }
});

// POST /user/watchlist
userRoutes.post("/watchlist", async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json();
  const { mediaId, title, mediaType = "movie", posterUrl, releaseInfo } = body;

  if (!mediaId || !title) {
    return c.json({ error: "mediaId and title are required" }, 400);
  }

  try {
    const item = await prisma.watchlist.upsert({
      where: {
        userId_mediaId: {
          userId: user.id,
          mediaId: String(mediaId),
        },
      },
      update: {
        title,
        mediaType,
        posterUrl,
        releaseInfo,
      },
      create: {
        userId: user.id,
        mediaId: String(mediaId),
        title,
        mediaType,
        posterUrl,
        releaseInfo,
      },
    });

    return c.json({ success: true, item });
  } catch (err) {
    console.error("Error adding to watchlist:", err);
    return c.json({ error: "Failed to add to watchlist" }, 500);
  }
});

// DELETE /user/watchlist/:mediaId
userRoutes.delete("/watchlist/:mediaId", async (c) => {
  const user = c.get("user") as AuthUser;
  const mediaId = c.req.param("mediaId");

  try {
    await prisma.watchlist.deleteMany({
      where: {
        userId: user.id,
        mediaId,
      },
    });
    return c.json({ success: true, removed: mediaId });
  } catch {
    return c.json({ error: "Failed to remove from watchlist" }, 500);
  }
});
