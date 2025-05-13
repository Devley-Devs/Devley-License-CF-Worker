export default {
	async fetch(request: Request, env: Record<string, string>) {
    const ip: string = request.headers.get('CF-Connecting-IP') ?? '0.0.0.0'
    try {
      const url = new URL(request.url)
      if ((request.method === "GET") && (url.pathname == '/getEndpoints')) {
        return new Response(JSON.stringify({ 
          dashboard_url: env.DASHBOARD_URL,
          websocket_url: env.WEBSOCKET_URL
         }), { status: 200 });
      } else {
        return new Response(`Devley Licensing System V${env.VERSION}`, {status: 302});
      }
    } catch (err) {
      console.log("ERROR OCCURED", ip, err)
      return new Response(`Devley Licensing System V${env.VERSION}`, {status: 302});
    }
	},
};