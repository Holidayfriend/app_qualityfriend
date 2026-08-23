import { queryDatabase } from "@/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DatabaseHealthRow = {
  database: string;
  server_time: Date;
};

export async function GET() {
  try {
    const result = await queryDatabase<DatabaseHealthRow>(
      "SELECT current_database() AS database, NOW() AS server_time",
    );
    const connection = result.rows[0];

    return Response.json({
      status: "connected",
      database: connection.database,
      serverTime: connection.server_time,
    });
  } catch (error) {
    console.error("Database health check failed", error);

    return Response.json(
      {
        status: "error",
        message: "Unable to connect to the database.",
      },
      { status: 503 },
    );
  }
}
