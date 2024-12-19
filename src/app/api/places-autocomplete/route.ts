import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const input = searchParams.get("input");

  if (!input) {
    return NextResponse.json({ error: "Input is required" }, { status: 400 });
  }

  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

  if (!GOOGLE_API_KEY) {
    console.error("GOOGLE_API_KEY is not set");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input
    )}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.predictions) {
      const results = data.predictions.map((prediction: any) => ({
        placeId: prediction.place_id,
        displayName: prediction.description,
      }));
      return NextResponse.json(results);
    } else {
      return NextResponse.json(
        {
          error: "No predictions found",
          details: {
            status: data.status,
            errorMessage: data.error_message,
          },
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error fetching place predictions:", error);
    return NextResponse.json(
      {
        error: "Error fetching place predictions",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
