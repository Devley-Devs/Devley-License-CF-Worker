import { LicenseWS } from './methods/ws';
import { LicenseHTTP } from './methods/http';

export default {
	async fetch(request, env) {
    const ip = request.headers.get('CF-Connecting-IP')
    try {
      const url = new URL(request.url)
      const upgradeHeader = request.headers.get('Upgrade');
      if ((request.method === "POST") && (url.pathname == '/')) {
        return await LicenseHTTP(request, ip, env)
      } else if (upgradeHeader && upgradeHeader === 'websocket') {
        const { ws_client, response } = await LicenseWS(ip, env)
        if (response) {
          return response;
        }
        return new Response(null, {
          status: 101,
          webSocket: ws_client,
        });
      } else if (request.method === "GET") {
        return new Response(`${env.PRODUCT_NAME} Licensing System V${env.VERSION}`, {status: 302});
      }
    } catch (err) {
      console.log("ERROR OCCURED", ip, err)
      return new Response(`${env.PRODUCT_NAME} Licensing System V${env.VERSION}`, {status: 302});
    }
	},
};