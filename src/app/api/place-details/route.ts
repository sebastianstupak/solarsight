import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const placeId = searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json(
      { error: "Place ID is required" },
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
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (
      data.status === "OK" &&
      data.result &&
      data.result.geometry &&
      data.result.geometry.location
    ) {
      return NextResponse.json({
        location: data.result.geometry.location,
      });
    } else {
      return NextResponse.json(
        {
          error: "Place details not found",
          details: {
            status: data.status,
            errorMessage: data.error_message,
          },
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error fetching place details:", error);
    return NextResponse.json(
      {
        error: "Error fetching place details",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
