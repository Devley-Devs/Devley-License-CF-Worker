import { ObjectId } from 'bson';
import * as Realm from 'realm-web';

export default {
	async fetch(request, env) {
		const ip = request.headers.get('CF-Connecting-IP')
    const upgradeHeader = request.headers.get('Upgrade');
		if (request.method === "POST") {
			if (!(request.headers.get("Authorization") === `Bearer ${env.AUTHORIZATION_HEADER}`)) {
				const request_body = await request.json()
        try {
          var splitted_data = request_body.license_key.split("_")
          var transaction_id = splitted_data[0]
          var user_id = splitted_data[1]
        } catch {
          return new Response(JSON.stringify({'status': `License Key is in Wrong Format`}), {status: 403});
        }
        try {
          var uuid = splitted_data[2]
        } catch {
          var uuid = undefined
        }
        try {
          const app = new Realm.App({ id: env.REALM_ID });
          var user = await app.logIn(Realm.Credentials.apiKey(env.REALM_API));
          var client = user.mongoClient('mongodb-atlas');
          var Licenses = client.db('DevleyDB').collection('Licenses')
          var Products = client.db('DevleyDB').collection('Products')
          var ProductActivities = client.db('DevleyDB').collection('ProductActivities')
        } catch(err) {
          return new Response(JSON.stringify({'status': `Database Error`}), {status: 500});
        }
        const licenses = await Licenses.findOne({ _id: String(user_id) })
				const db_data = licenses?.products[env.PRODUCT_ID]
        const embed_fields = [
					{ name: "License IP", value: `> ${"`"}${ip}${"`"}`, inline: true },
					{ name: "Time", value: `> <t:${parseInt(Date.now() / 1000)}>`, inline: true },
					{ name: "Version", value: `> ${(request_body.version == null) ? 'Unknown' : request_body.version}`, inline: true },
					{ name: "Transaction ID", value: `> ${transaction_id}`, inline: false },
					{ name: "User", value: `> <@!${user_id}>`, inline: true },
					{ name: "User ID", value: `> ${user_id}`, inline: true },
					{ name: "Dashboard", value: `${env.DASHBOARD_URL}/admin/${user_id}/profile`, inline: false },
					{ name: "License Key", value: `**${"```"}yaml\nLICENSE:\n    LICENSE_KEY: ${request_body.license_key}\n${"```"}**`, inline: false }
				]
        let embed = { type: "rich",
          author: {name: `${env.PRODUCT_NAME}`, icon_url: env.PRODUCT_ICON},
          footer: {text: `${env.PRODUCT_NAME} License`, icon_url: env.PRODUCT_ICON},
        }
				if ((db_data == null) || (db_data?.transaction_id != transaction_id) || (db_data?.misc?.uuid != uuid)) {
					const invalidKey = { name: "Invalid License Key", value: `**${"```"}${request_body.license_key}${"```"}**`, inline: false }
					embed = {...embed, fields: [...embed_fields.slice(0, 3), invalidKey], description: "### `❌` Invalid License Key Passed", timestamp: new Date().toISOString(), color: 16390168}
          try {
            await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers: {"Content-Type": 'application/json'}, body: JSON.stringify({ embeds: [embed] })})
					} catch {}
          return new Response(JSON.stringify({error :"License Key Not Found"}), {status: 404});
				} else if (db_data?.blocked) {
          embed = {...embed, fields: embed_fields, description: "### `⛔` Blocked License Key", timestamp: new Date().toISOString(), color: 16390168}
          if (String(env.OWNER_ID) != String(user_id)) {
            await ProductActivities.insertOne({ user_id: user_id, product_id: env.PRODUCT_ID, version: request_body.version, time: new Date(), ip: ip, machine_id: request_body?.machine_id, status: '⛔' })
            try { await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers: {"Content-Type": 'application/json'}, body: JSON.stringify({ embeds: [embed] })}) }
            catch {}
          }
					return new Response(JSON.stringify({error :"License Key has been Blocked"}), {status: 402});
        } else {
          embed = {...embed, fields: embed_fields, description: "### `✅` Successfully sent the License Key", timestamp: new Date().toISOString(), color: env.COLOR}
          if (String(env.OWNER_ID) != String(user_id)) {
            await ProductActivities.insertOne({ user_id: user_id, product_id: env.PRODUCT_ID, version: request_body.version, time: new Date(), ip: ip, machine_id: request_body?.machine_id, status: '✅' })
            try { await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers: {"Content-Type": 'application/json'}, body: JSON.stringify({ embeds: [embed] })}) }
            catch {}
          }
          try {
            var product = await Products.findOne({ _id: new ObjectId(env.PRODUCT_ID) })
            delete product.link
          } catch { var product = {} }
					return new Response(JSON.stringify({license_key: db_data.license_key, product: product}), {status: 200});
				}
			} else {
				const embed = {...embed, description: `### ${"`"}⚠️${"`"} UnAuthorized Access to the Licence Server\n**IP :** ${"`"}${ip}${"`"}\n**Time :** <t:${parseInt(Date.now() / 1000)}>`, timestamp: new Date().toISOString(), color: 16763904}
        try {
				  await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers: {"Content-Type": 'application/json'}, body: JSON.stringify({ embeds: [embed] })})
        } catch {}
        return new Response(JSON.stringify({error :"UnAuthorized Access"}), {status: 403});
			}
		} else if (upgradeHeader && upgradeHeader === 'websocket') {
      const webSocketPair = new WebSocketPair();
      const [ws_client, ws_server] = Object.values(webSocketPair);
      ws_server.accept();
      ws_client.auth_success = false
      ws_client.user_id = null
      ws_client.version = null
      ws_client.session_id = null
      ws_client.machine_id = null
      try {
        const app = new Realm.App({ id: env.REALM_ID });
        var user = await app.logIn(Realm.Credentials.apiKey(env.REALM_API));
        var client = user.mongoClient('mongodb-atlas');
        var Licenses = client.db('DevleyDB').collection('Licenses')
        var OnlineLicenses = client.db('DevleyDB').collection('OnlineLicenses')
      } catch(err) {
        return new Response(JSON.stringify({'status': `Database Error`}), {status: 500});
      }
      ws_server.addEventListener('message', async (event) => {
        try {
          const ws_data = JSON.parse(event.data)
          console.log(ws_data)
          if (ws_data.event === 'license_key') {
            var splitted_data = ws_data.data.split("_")
            var transaction_id = splitted_data[0]
            ws_client.version = ws_data.version
            ws_client.session_id = ws_data.session_id
            ws_client.machine_id = ws_data.machine_id
            ws_client.user_id = splitted_data[1]
            try {
              var uuid = splitted_data[2]
            } catch {
              var uuid = undefined
            }
            const licenses = await Licenses.findOne({ _id: String(ws_client.user_id) })
            const db_data = licenses?.products[env.PRODUCT_ID]
            if ((db_data != null) && (db_data?.transaction_id == transaction_id) && (db_data?.misc?.uuid == uuid) && (!db_data?.blocked)) {
              ws_client.auth_success = true
              ws_server.send(JSON.stringify({'event': 'auth_success', 'keepalive': env.WS_KEEPALIVE}))
              const previousConnection = await OnlineLicenses.findOneAndUpdate({ session_id: ws_client.session_id }, { user_id: ws_client.user_id, product_id: env.PRODUCT_ID, version: ws_client.version, time: new Date(), ip: ip, session_id: ws_client.session_id, machine_id: ws_client.machine_id })
              if (previousConnection == null) {
                await OnlineLicenses.insertOne({ user_id: ws_client.user_id, product_id: env.PRODUCT_ID, version: ws_client.version, time: new Date(), ip: ip, session_id: ws_client.session_id, machine_id: ws_client.machine_id })
              }
            } else {
              ws_server.send(JSON.stringify({'event': 'auth_failed'}))
              return ws_server.close(1008, "ERROR: Invalid License Key")
            }
          } else if ((ws_data.event === 'keepalive') && (ws_client.auth_success)) {
            ws_client.version = ws_data.version
            ws_client.session_id = ws_data.session_id
            ws_client.machine_id = ws_data.machine_id
            const activeConnections = await OnlineLicenses.find({ user_id: ws_client.user_id })
            for (let conn in activeConnections) {
              if (new Date(activeConnections[conn].time.getTime() + ((env.WS_KEEPALIVE)*1000)) < new Date()) {
                await OnlineLicenses.deleteOne({ session_id: activeConnections[conn].session_id })
                activeConnections.splice(conn, conn)
              }
            }
            console.log(activeConnections)
            if (activeConnections.length >= 2) {
              ws_server.send(JSON.stringify({ 'event': 'killconn' }))
              return await OnlineLicenses.deleteOne({ session_id: ws_client.session_id })
            }
            const previousConnection = await OnlineLicenses.findOneAndUpdate({ session_id: ws_client.session_id }, { user_id: ws_client.user_id, product_id: env.PRODUCT_ID, version: ws_client.version, time: new Date(), ip: ip, session_id: ws_client.session_id, machine_id: ws_client.machine_id })
            if (previousConnection == null) {
              await OnlineLicenses.insertOne({ user_id: ws_client.user_id, product_id: env.PRODUCT_ID, version: ws_client.version, time: new Date(), ip: ip, session_id: ws_client.session_id, machine_id: ws_client.machine_id })
            }
            ws_server.send(JSON.stringify({ 'event': 'keepalive' }))
          }
        } catch {
          ws_server.send(JSON.stringify({'event': "error", "data": "License Key in Wrong Format"}));
          return ws_server.close(1008, "ERROR: Invalid License Key Format")
        }
      });
      ws_server.addEventListener('close', async (event) => {
        if ((ws_client.auth_success) && (ws_client.session_id)) {
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