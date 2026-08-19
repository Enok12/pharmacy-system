import { createHash, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { UnauthorizedError } from "@/lib/errors";
import { signAccessToken, signRefreshToken, verifyRefreshToken, refreshTokenTtlMs } from "@/lib/jwt";

const log = createLogger("services/auth-service");

// Refresh tokens are looked up by a deterministic hash (unlike password
// hashing, we need to find the row *before* we can compare — bcrypt can't
// do that). The JWT signature is still what proves possession; this hash
// only lets us revoke/rotate a specific token server-side.
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function toSafeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function issueTokens(user) {
  const jti = randomUUID();
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  const refreshToken = await signRefreshToken({ sub: user.id, jti });

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
    },
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async login(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Same generic error whether the email doesn't exist or the password is
    // wrong — confirming an email exists is its own information leak.
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const tokens = await issueTokens(user);
    log.info("User logged in", { userId: user.id });
    return { user: toSafeUser(user), ...tokens };
  },

  async refresh(refreshToken) {
    const payload = refreshToken ? await verifyRefreshToken(refreshToken) : null;
    if (!payload) throw new UnauthorizedError("Invalid or expired session");

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid or expired session");
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid or expired session");
    }

    // Rotate: revoke the token we just used and issue a fresh pair. If a
    // stolen refresh token is ever replayed after the legitimate rotation,
    // this makes the reuse detectable (the row is already revoked).
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await issueTokens(user);
    return { user: toSafeUser(user), ...tokens };
  },

  async logout(refreshToken) {
    if (!refreshToken) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
