import { LicenseWS } from './methods/ws';

export default {
	async fetch(request, env) {
    const ip = request.headers.get('CF-Connecting-IP')
    try {
      const url = new URL(request.url)
      const upgradeHeader = request.headers.get('Upgrade');
      if ((request.method === "GET") && (url.pathname == '/getEndpoints')) {
        return new Response(JSON.stringify({ 
          dashboard_url: env.DASHBOARD_URL,
          websocket_url: env.WEBSOCKET_URL
         }), { status: 200 });
      } else if ((request.method === "POST") && (url.pathname == '/')) {
        const licenseData = await fetch(`${env.DASHBOARD_URL}/api/getLicense`, {
          method: "POST"
        })
        return new Response(JSON.stringify(await licenseData.json()), { status: licenseData.status });
      } else if (upgradeHeader && upgradeHeader === 'websocket') {
        const { ws_client, response } = await LicenseWS(ip, env)
        if (response) {
          return response;
        }
        return new Response(null, {
          status: 101,
          webSocket: ws_client,
        });
      } else {
        return new Response(`${env.PRODUCT_NAME} Licensing System V${env.VERSION}`, {status: 302});
      }
    } catch (err) {
      console.log("ERROR OCCURED", ip, err)
      return new Response(`${env.PRODUCT_NAME} Licensing System V${env.VERSION}`, {status: 302});
    }
	},
};