import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAnonSupabaseClient,
  isSupabaseConfigured,
  SB_ACCESS_COOKIE,
  SB_REFRESH_COOKIE,
} from "@/lib/db/supabase-auth";
import { SupabaseProgressRepository } from "@/lib/db/supabase-repository";

const AuthRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("signin"),
    email: z.string().email(),
    password: z.string().min(6),
  }),
  z.object({
    action: z.literal("signup"),
    email: z.string().email(),
    password: z.string().min(6),
  }),
  z.object({
    action: z.literal("signout"),
  }),
]);

function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
) {
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set(SB_ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set(SB_REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function POST(req: Request) {
  try {
    const parsed = AuthRequestSchema.parse(await req.json());

    if (parsed.action === "signout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(SB_ACCESS_COOKIE);
      res.cookies.delete(SB_REFRESH_COOKIE);
      return res;
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "Supabase ortam değişkenleri (NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY) henüz yapılandırılmamış.",
        },
        { status: 400 }
      );
    }

    const client = createAnonSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { error: "Supabase istemcisi başlatılamadı." },
        { status: 500 }
      );
    }

    if (parsed.action === "signin") {
      const { data, error } = await client.auth.signInWithPassword({
        email: parsed.email,
        password: parsed.password,
      });

      if (error || !data.session || !data.user) {
        return NextResponse.json(
          {
            error:
              error?.message === "Email not confirmed"
                ? "E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzdaki onay bağlantısını açın."
                : "E-posta veya parola hatalı ya da kullanıcı bulunamadı.",
          },
          { status: 401 }
        );
      }

      // Ensure user profile & starter Fatiha state exist on first sign-in
      const sbRepo = new SupabaseProgressRepository(
        data.session.access_token,
        data.user.id
      );
      await sbRepo.getDashboardSnapshot(data.user.id);

      const res = NextResponse.json({
        ok: true,
        email: data.user.email ?? parsed.email,
      });
      setSessionCookies(
        res,
        data.session.access_token,
        data.session.refresh_token
      );
      return res;
    }

    // Signup flow
    const { data, error } = await client.auth.signUp({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) {
      return NextResponse.json(
        { error: `Kayıt oluşturulamadı: ${error.message}` },
        { status: 400 }
      );
    }

    if (!data.session || !data.user) {
      return NextResponse.json({
        ok: true,
        needsEmailVerification: true,
        messageTr:
          "Hesap oluşturuldu! E-posta kutunuzdaki doğrulama bağlantısını onayladıktan sonra buradan giriş yapabilirsiniz.",
      });
    }

    const sbRepo = new SupabaseProgressRepository(
      data.session.access_token,
      data.user.id
    );
    await sbRepo.getDashboardSnapshot(data.user.id);

    const res = NextResponse.json({
      ok: true,
      email: data.user.email ?? parsed.email,
    });
    setSessionCookies(
      res,
      data.session.access_token,
      data.session.refresh_token
    );
    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Geçerli bir e-posta ve en az 6 karakterli parola girin." },
        { status: 400 }
      );
    }
    console.error("POST /api/auth failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Kimlik doğrulama işlemi sırasında beklenmeyen hata oluştu.",
      },
      { status: 500 }
    );
  }
}
