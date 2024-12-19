import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
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
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      const address = data.results[0].formatted_address;
      return NextResponse.json({ address });
    } else {
      return NextResponse.json(
        {
          error: "Address not found",
          details: {
            status: data.status,
            errorMessage: data.error_message,
            results: data.results,
          },
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error fetching address:", error);
    return NextResponse.json(
      {
        error: "Error fetching address",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
