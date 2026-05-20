export async function GET(_request: Request, context: { params: Promise<{ type: string }> }) {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const { type } = await context.params;
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/export/${type}.csv`);
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${type}.csv"`
    }
  });
}
