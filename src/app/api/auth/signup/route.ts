import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Test database connectivity first
    try {
      await prisma.$connect();
    } catch (dbError) {
      console.error("Database connection failed:", dbError);
      return NextResponse.json(
        { error: "Database is not configured. Please set up DATABASE_URL in your environment variables (e.g., from Neon.tech)." },
        { status: 503 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const verifyToken = crypto.randomBytes(24).toString("hex");

    const created = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        fullName,
        passwordHash: hashedPassword,
        emailVerified: false,
        verifyToken,
        notificationPreferences: {
          create: {},
        },
      },
    });

    void sendNotificationEmail({
      userId: created.id,
      type: "welcome",
      recipientEmail: created.email,
      subject: "Welcome to Seatvio",
      body: `Welcome to Seatvio, ${fullName}.\n\nYour account is ready. Verify your email, complete onboarding, and start your first interview simulation.`,
    });

    return NextResponse.json(
      {
        message: "Account created. Verify your email to continue.",
        verificationPath: `/verify-email?token=${verifyToken}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);

    const message = error instanceof Error ? error.message : "";

    if (message.includes("connect") || message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
      return NextResponse.json(
        { error: "Cannot connect to the database. Please check your DATABASE_URL environment variable." },
        { status: 503 }
      );
    }

    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    if (message.includes("does not exist") || message.includes("relation")) {
      return NextResponse.json(
        { error: "Database tables not set up. Run 'npx prisma db push' to create them." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
