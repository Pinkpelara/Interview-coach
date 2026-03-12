import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token?.trim();
  let success = false;
  let error = "";

  if (!token) {
    error = "Missing verification token.";
  } else {
    try {
      const user = await prisma.user.findFirst({
        where: { verifyToken: token },
        select: { id: true, emailVerified: true },
      });

      if (!user) {
        error = "Invalid or expired verification link.";
      } else {
        if (!user.emailVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              emailVerified: true,
              verifyToken: null,
            },
          });
        }
        success = true;
      }
    } catch {
      error = "Unable to verify email.";
    }
  }

  return (
    <Card>
      <CardContent>
        <div className="text-center space-y-4 py-2">
          <h2 className="text-xl font-semibold text-gray-900">Verify your email</h2>

          {success ? (
            <>
              <p className="text-sm text-green-700">
                Your email has been verified. You can now sign in.
              </p>
              <Link href="/login">
                <Button className="w-full">Go to login</Button>
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-red-600">{error || "Verification failed."}</p>
              <Link href="/signup">
                <Button variant="outline" className="w-full">
                  Back to signup
                </Button>
              </Link>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
