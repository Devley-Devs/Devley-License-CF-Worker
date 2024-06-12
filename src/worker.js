import { ObjectId } from 'bson';
import * as Realm from 'realm-web';

export default {
	async fetch(request, env) {

    function parseLicenseResponse(request_body) {
      const returnObject = Object()
      const splitted_data = request_body?.license_key?.split("_")
      returnObject.transaction_id = splitted_data.at(0)
      returnObject.user_id = splitted_data.at(1)
      returnObject.uuid = splitted_data.at(2)
      returnObject.version = request_body?.version
      returnObject.session_id = request_body?.session_id
      returnObject.machine_id = request_body?.machine_id
      return returnObject
    }
    
    async function initializeDatabase() {
      try {
        const mongoDB = new Realm.App({ id: env.REALM_ID });
        const mongoAuth = await mongoDB.logIn(Realm.Credentials.apiKey(env.REALM_API));
        const client = mongoAuth.mongoClient('mongodb-atlas');
        const Licenses = client.db('DevleyDB').collection('Licenses')
        const Products = client.db('DevleyDB').collection('Products')
        const OnlineLicenses = client.db('DevleyDB').collection('OnlineLicenses')
        const ProductActivities = client.db('DevleyDB').collection('ProductActivities')
        return Object({ Licenses, Products, ProductActivities, OnlineLicenses })
      } catch {
        return Object()
      }
    }
    
    async function executeDiscordWebhook(parsedLicense, ip, description, color) {
      const embed_fields = [
        { name: "Transaction ID", value: `> ${parsedLicense.transaction_id}`, inline: true },
        { name: "License IP", value: `> [${ip}](https://whatismyipaddress.com/ip/${ip})`, inline: true },
        { name: "Time", value: `> <t:${parseInt(Date.now() / 1000)}>`, inline: true },
        { name: "User", value: `> <@!${parsedLicense.user_id}> [${parsedLicense.user_id}]`, inline: false },
        { name: "Session ID", value: `> ${(parsedLicense.session_id == null) ? 'Unknown' : parsedLicense.session_id.toUpperCase()}`, inline: true },
        { name: "Machine ID", value: `> ${(parsedLicense.machine_id == null) ? 'Unknown' : parsedLicense.machine_id.toUpperCase()}`, inline: true },
        { name: "Version", value: `> ${(parsedLicense.version == null) ? 'Unknown' : parsedLicense.version}`, inline: true },
        { name: "Dashboard", value: `${env.DASHBOARD_URL}/admin/${parsedLicense.user_id}/profile`, inline: false },
      ]
      const embed = { type: "rich", color: color,
        fields: embed_fields,
        description: description,
        timestamp: new Date().toISOString(),
        author: {name: `${env.PRODUCT_NAME}`, icon_url: env.PRODUCT_ICON},
        footer: {text: `${env.PRODUCT_NAME} License`, icon_url: env.PRODUCT_ICON},
      }
      try {
        await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers: {"Content-Type": 'application/json'}, body: JSON.stringify({ embeds: [embed] })})
      } catch {}
    }

    const ip = request.headers.get('CF-Connecting-IP')
    const upgradeHeader = request.headers.get('Upgrade');
		if (request.method === "POST") {
			if (!(request.headers.get("Authorization") === `Bearer ${env.AUTHORIZATION_HEADER}`)) {
				const request_body = await request.json()
        const parsedLicense = parseLicenseResponse(request_body)
        if ((parsedLicense.transaction_id == null) && (parsedLicense.user_id == null)) {
          return new Response(JSON.stringify({ 'status': 'License Key is in Wrong Format' }), { status: 403 });
        }
        const { Licenses, Products, ProductActivities } = await initializeDatabase()
        if (Licenses == null) {
          return new Response(JSON.stringify({ 'status': 'Database Error' }), { status: 500 })
        }
        const licenses = await Licenses.findOne({ _id: String(parsedLicense.user_id) })
				const db_data = licenses?.products[env.PRODUCT_ID]
				if ((db_data == null) || (db_data?.transaction_id != parsedLicense.transaction_id) || (db_data?.misc?.uuid != parsedLicense.uuid)) {
          await executeDiscordWebhook(parsedLicense, ip, "### `❌` Invalid License Key Passed", 16390168)
          return new Response(JSON.stringify({ error :"License Key Not Found" }), { status: 404 });
				} else if (db_data?.blocked) {
          if (String(env.OWNER_ID) != String(parsedLicense.user_id)) {
            await ProductActivities.insertOne({ user_id: parsedLicense.user_id, product_id: env.PRODUCT_ID, version: parsedLicense.version, time: new Date(), ip: ip, session_id: parsedLicense.session_id, machine_id: parsedLicense.machine_id, status: '⛔' })
            await executeDiscordWebhook(parsedLicense, ip, "### `⛔` Blocked License Key", 16390168)
          }
					return new Response(JSON.stringify({ error :"License Key has been Blocked" }), { status: 402 });
        } else {
          if (String(env.OWNER_ID) != String(parsedLicense.user_id)) {
            await ProductActivities.insertOne({ user_id: parsedLicense.user_id, product_id: env.PRODUCT_ID, version: parsedLicense.version, time: new Date(), ip: ip, session_id: parsedLicense.session_id, machine_id: parsedLicense.machine_id, status: '✅' })
            await executeDiscordWebhook(parsedLicense, ip, "### `✅` Successfully sent the License Key", env.COLOR)
          }
          var product = await Products.findOne({ _id: new ObjectId(env.PRODUCT_ID) }) || Object()
          delete product.link
					return new Response(JSON.stringify({ license_key: db_data.license_key, product: product }), { status: 200 });
				}
			} else {
        await executeDiscordWebhook(parsedLicense, ip, "### `⚠️` UnAuthorized Access to the Licence Server", 16763904)
        return new Response(JSON.stringify({ error :"UnAuthorized Access" }), { status: 403 });
			}
		} else if (upgradeHeader && upgradeHeader === 'websocket') {
      const webSocketPair = new WebSocketPair();
      const [ws_client, ws_server] = Object.values(webSocketPair);
      ws_server.accept();
      ws_client.total_pings = 0
      ws_client.user_id = null
      ws_client.version = null
      ws_client.session_id = null
      ws_client.machine_id = null
      const { OnlineLicenses } = await initializeDatabase()
      if (OnlineLicenses == null) {
        return new Response(JSON.stringify({ 'status': 'Database Error' }), { status: 500 })
      }
      ws_server.addEventListener('message', async (event) => {
        const ws_data = JSON.parse(event.data)
        if (ws_data?.event === 'keepalive') {
          const parsedLicense = parseLicenseResponse(ws_data)
          ws_client.user_id = parsedLicense.user_id
          ws_client.version = parsedLicense.version
          ws_client.session_id = parsedLicense.session_id
          ws_client.machine_id = parsedLicense.machine_id
          const activeConnections = await OnlineLicenses.find({ user_id: ws_client.user_id }) || []
          if ((ws_client.total_pings > 0) && (!activeConnections.map(d => d.session_id).includes(ws_client.session_id))) {
            return ws_server.send(JSON.stringify({ 'event': 'killconn' }))
          }
          for (let conn in activeConnections) {
            if (new Date(activeConnections[conn].time.getTime() + ((activeConnections[conn].keepalive)*1000)) < new Date()) {
              await OnlineLicenses.deleteOne({ session_id: activeConnections[conn].session_id })
              activeConnections.splice(conn, conn)
            }
            if (activeConnections[conn].session_id == ws_client.session_id) {
              activeConnections.splice(conn, 1)
            }
          }
          if (activeConnections.length >= 1) {
            return ws_server.send(JSON.stringify({ 'event': 'killconn' }))
          }
          const previousConnection = await OnlineLicenses.findOneAndUpdate({ session_id: ws_client.session_id }, { user_id: ws_client.user_id, product_id: env.PRODUCT_ID, version: ws_client.version, time: new Date(), ip: ip, keepalive: env.WS_KEEPALIVE, session_id: ws_client.session_id, machine_id: ws_client.machine_id })
          if (previousConnection == null) {
            await OnlineLicenses.insertOne({ user_id: ws_client.user_id, product_id: env.PRODUCT_ID, version: ws_client.version, time: new Date(), ip: ip, keepalive: env.WS_KEEPALIVE, session_id: ws_client.session_id, machine_id: ws_client.machine_id })
          }
          ws_server.send(JSON.stringify({ 'event': 'keepalive', 'keepalive': env.WS_KEEPALIVE }))
          ws_client.total_pings += 1
        }
      });
      ws_server.addEventListener('close', async (event) => {
        if (ws_client.session_id) {
          await OnlineLicenses.deleteOne({ session_id: ws_client.session_id })
        }
        return ws_server.close(1000, "Closing the License Websocket Connection")
      });
      return new Response(null, {
        status: 101,
        webSocket: ws_client,
      });
    } else if (request.method === "GET") {
			return new Response(`${env.PRODUCT_NAME} Licensing System V${env.VERSION}`, {status: 302});
		}
	},
};