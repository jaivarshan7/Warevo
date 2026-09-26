import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

describe("Email Recipient and Portal Link Routing", () => {
  it("public/_redirects exists and rewrites all SPA routes to index.html with 200", () => {
    const redirectsPath = resolve(__dirname, "../public/_redirects");
    expect(existsSync(redirectsPath)).toBe(true);
    const content = readFileSync(redirectsPath, "utf-8");
    expect(content).toMatch(/\/\*\s+\/index\.html\s+200/);
  });

  it("netlify.toml exists and configures SPA fallback", () => {
    const netlifyPath = resolve(__dirname, "../netlify.toml");
    expect(existsSync(netlifyPath)).toBe(true);
    const content = readFileSync(netlifyPath, "utf-8");
    expect(content).toContain('from = "/*"');
    expect(content).toContain('to = "/index.html"');
    expect(content).toContain("status = 200");
  });

  it("dist/_redirects exists after build and contains SPA rewrite rule", () => {
    const distRedirectsPath = resolve(__dirname, "../dist/_redirects");
    expect(existsSync(distRedirectsPath)).toBe(true);
    const content = readFileSync(distRedirectsPath, "utf-8");
    expect(content).toMatch(/\/\*\s+\/index\.html\s+200/);
  });

  it("App.tsx has routes for both /orders/:id and /operations/orders/:id and /invoices/:id", () => {
    const appPath = resolve(__dirname, "../src/App.tsx");
    const content = readFileSync(appPath, "utf-8");
    expect(content).toContain('path="orders/:id"');
    expect(content).toContain('path="operations/orders/:id"');
    expect(content).toContain('path="invoices/:id"');
  });

  it("AppShell and ProtectedRoute preserve location in redirect to /login", () => {
    const appShellPath = resolve(__dirname, "../src/components/layout/AppShell.tsx");
    const appShellContent = readFileSync(appShellPath, "utf-8");
    expect(appShellContent).toContain('state={{ from: location }}');

    const protectedRoutePath = resolve(__dirname, "../src/components/auth/ProtectedRoute.tsx");
    const protectedRouteContent = readFileSync(protectedRoutePath, "utf-8");
    expect(protectedRouteContent).toContain('state={{ from: location }}');
  });

  it("LoginPage navigates to from destination after successful authentication", () => {
    const loginPagePath = resolve(__dirname, "../src/pages/auth/LoginPage.tsx");
    const content = readFileSync(loginPagePath, "utf-8");
    expect(content).toContain("const from =");
    expect(content).toContain("navigate(from, { replace: true });");
  });

  it("send-email Edge Function uses verified domain warevo.online and Vercel production URL", () => {
    const edgeFunctionPath = resolve(__dirname, "../supabase/functions/send-email/index.ts");
    const content = readFileSync(edgeFunctionPath, "utf-8");
    expect(content).toContain("Warevo <notifications@warevo.online>");
    expect(content).toContain("https://warevo-three.vercel.app");
    expect(content).not.toContain("https://warevo.in");
    expect(content).not.toContain("onboarding@resend.dev");
  });
});
