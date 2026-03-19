import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts";
import { join, relative, dirname, basename } from "https://deno.land/std@0.208.0/path/mod.ts";

type Handler = (req: Request) => Promise<Response> | Response;

interface Route {
  pattern: URLPattern;
  handler: Handler;
  path: string;
}

export class Router {
  private routes: Route[] = [];
  private apiDir: string;

  constructor(apiDir: string) {
    this.apiDir = apiDir;
  }

  async init() {
    const entries = walk(this.apiDir, {
      includeFiles: true,
      includeDirs: false,
      match: [/index\.ts$/],
    });

    for await (const entry of entries) {
      const relativePath = relative(this.apiDir, entry.path);
      // Convert file path to route path
      // e.g. odoo/invoices/index.ts -> /api/odoo/invoices
      // e.g. odoo/invoices/[id]/index.ts -> /api/odoo/invoices/:id
      
      const dir = dirname(relativePath);
      let routePath = "/api/" + dir;
      
      if (dir === ".") {
        routePath = "/api";
      }

      // Replace [param] with :param
      routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");

      // Import the handler
      // We need to use absolute path or relative to this file for dynamic import
      const module = await import(entry.path);
      
      // Expect default export to be the handler
      if (typeof module.default === "function") {
        this.routes.push({
          pattern: new URLPattern({ pathname: routePath }),
          handler: module.default,
          path: routePath,
        });
        console.log(`Registered route: ${routePath}`);
      } else {
        console.warn(`No default export found in ${entry.path}`);
      }
    }

    // Sort routes to ensure specific routes match before dynamic ones if needed
    // But URLPattern usually handles this? No, we iterate linearly.
    // So we should sort by specificity.
    // Simple heuristic: longer static parts first?
    // Or just rely on the order.
    // Let's sort by length descending to match specific paths first
    this.routes.sort((a, b) => b.path.length - a.path.length);
  }

  match(req: Request): Handler | null {
    const url = new URL(req.url);
    for (const route of this.routes) {
      if (route.pattern.test(url)) {
        return route.handler;
      }
    }
    return null;
  }
}

export async function createRouter(apiDir: string) {
  const router = new Router(apiDir);
  await router.init();
  return router;
}
