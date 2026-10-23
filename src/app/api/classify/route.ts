import {
  classifyWithJev,
  mapJevPriorityToAppPriority,
} from "@/lib/delivery/classify-jev";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'text' parameter" },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const result = await classifyWithJev(text.slice(0, 2000), apiKey);

    // Map Jev priority to app priority
    const appPriority = mapJevPriorityToAppPriority(result.priority);

    return NextResponse.json({
      ...result,
      appPriority,
    });
  } catch (error) {
    console.error("Classification API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Classification failed",
      },
      { status: 500 },
    );
  }
}
