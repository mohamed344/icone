import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = new Set(["/login", "/register"]);

function homeForRole(role: string | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "chef_de_ligne") return "/chef";
  return "/operator";
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not run code between createServerClient and the identity check.
  // getClaims() verifies the JWT locally (cached JWKS) and refreshes the session
  // via getSession() when needed — no Auth-server round-trip on every request.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ? { id: claimsData.claims.sub } : null;

  const path = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.has(path);

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // Not signed in → only auth routes are reachable.
  if (!user) {
    if (!isAuthRoute) return redirectTo("/login");
    return supabaseResponse;
  }

  // Signed in → keep them out of auth routes and off the bare root.
  if (isAuthRoute || path === "/") {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return redirectTo(homeForRole(data?.role as string | undefined));
  }

  return supabaseResponse;
}
