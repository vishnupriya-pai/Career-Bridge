Deno.serve((request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  return new Response("<Response/>", { headers: { "Content-Type": "application/xml; charset=utf-8" } });
});