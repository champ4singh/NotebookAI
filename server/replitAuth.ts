import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Set default domain if not provided
if (!process.env.REPLIT_DOMAINS) {
  // Use the actual repl domain from environment variables
  const replDomain = process.env.REPL_URL ? 
    new URL(process.env.REPL_URL).hostname : 
    (process.env.REPL_SLUG ? `${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.dev` : 'localhost:5000');
  
  process.env.REPLIT_DOMAINS = replDomain;
  console.log(`Using default domain: ${replDomain}`);
}

const getOidcConfig = memoize(
  async () => {
    const replId = process.env.REPL_ID;
    const issuerUrl = process.env.ISSUER_URL || "https://replit.com/oidc";
    
    if (!replId) {
      throw new Error('REPL_ID environment variable is required for authentication');
    }
    
    console.log(`OIDC Config - Issuer: ${issuerUrl}, Client ID: ${replId}`);
    
    return await client.discovery(
      new URL(issuerUrl),
      replId
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const domains = process.env.REPLIT_DOMAINS!.split(",");
  
  for (const domain of domains) {
    const trimmedDomain = domain.trim();
    const callbackURL = trimmedDomain.includes('localhost') ? 
      `http://${trimmedDomain}/api/callback` : 
      `https://${trimmedDomain}/api/callback`;
    
    console.log(`Setting up auth strategy for domain: ${trimmedDomain}, callback: ${callbackURL}`);
    
    const strategy = new Strategy(
      {
        name: `replitauth:${trimmedDomain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const strategyName = `replitauth:${req.hostname}`;
    console.log(`Login attempt for strategy: ${strategyName}`);
    
    passport.authenticate(strategyName, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    const strategyName = `replitauth:${req.hostname}`;
    console.log(`Callback received for strategy: ${strategyName}`);
    
    passport.authenticate(strategyName, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login?error=auth_failed",
    })(req, res, (err) => {
      if (err) {
        console.error('Authentication callback error:', err);
        return res.redirect("/api/login?error=callback_failed");
      }
      next();
    });
  });

  app.get("/api/logout", async (req, res) => {
    req.logout(async () => {
      try {
        const config = await getOidcConfig();
        const protocol = req.hostname.includes('localhost') ? 'http' : 'https';
        const port = req.hostname.includes('localhost') ? ':5000' : '';
        const redirectUri = `${protocol}://${req.hostname}${port}`;
        
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: redirectUri,
          }).href
        );
      } catch (error) {
        console.error('Error during logout:', error);
        res.redirect('/');
      }
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
