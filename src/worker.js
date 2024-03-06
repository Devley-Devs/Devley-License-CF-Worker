import * as Realm from 'realm-web';

export default {
	async fetch(request, env) {
		const ip = request.headers.get('CF-Connecting-IP')
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
          const credentials = Realm.Credentials.apiKey(env.REALM_API);
          var user = await app.logIn(credentials);
          var client = user.mongoClient('mongodb-atlas');
          var Licenses = client.db('DevleyDB').collection('Licenses')
          var ProductActivities = client.db('DevleyDB').collection('ProductActivities')
        } catch(err) {
          return new Response(JSON.stringify({'status': `Database Error`}), {status: 500});
        }
        const licenses = await Licenses.findOne({ _id: String(user_id) })
        await ProductActivities.insertOne({ user_id: user_id, product_id: env.PRODUCT_ID, version: request_body.version, time: new Date(), ip: ip })
				const db_data = licenses?.products[env.PRODUCT_ID]
        const embed_fields = [
					{ name: "License IP", value: `> ${"`"}${ip}${"`"}`, inline: true },
					{ name: "Time", value: `> <t:${parseInt(Date.now() / 1000)}>`, inline: true },
					{ name: "Version", value: `> ${(request_body.version == null) ? 'Unknown' : request_body.version}`, inline: true },
					{ name: "Transaction ID", value: `> ${transaction_id}`, inline: false },
					{ name: "User", value: `> <@!${user_id}>`, inline: true },
					{ name: "User ID", value: `> ${user_id}`, inline: true },
					{ name: "License Key", value: `**${"```"}yaml\nLICENSE:\n    LICENSE_KEY: ${request_body.license_key}\n${"```"}**`, inline: false }
				]
        let embed = { type: "rich",
          author: {name: `${env.PRODUCT_NAME}`, icon_url: env.PRODUCT_ICON},
          footer: {text: `${env.PRODUCT_NAME} License`, icon_url: env.PRODUCT_ICON},
        }
				if ((db_data == null) || (db_data.transaction_id != transaction_id) || (db_data?.misc?.uuid != uuid)) {
					embed = {...embed, fields: embed_fields, description: "### `❌` Invalid License Key Passed", timestamp: new Date().toISOString(), color: 16390168}
					try {
						await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers: {"Content-Type": 'application/json'}, body: JSON.stringify({ embeds: [embed] })
					})} catch (e) {}
					return new Response(JSON.stringify({error :"License Key Not Found"}), {status: 404});
				} else {
          embed = {...embed, fields: embed_fields, description: "### `✅` Successfully sent the License Key", timestamp: new Date().toISOString(), color: env.COLOR}
					try {
						await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers: {"Content-Type": 'application/json'}, body: JSON.stringify({ embeds: [embed] })
					})} catch (e) {}
					return new Response(JSON.stringify({license_key: db_data.license_key}), {status: 200});
				}
			} else {
				const embed = {...embed, description: `### ${"`"}⚠️${"`"} UnAuthorized Access to the Licence Server\n**IP :** ${"`"}${ip}${"`"}\n**Time :** <t:${parseInt(Date.now() / 1000)}>`, timestamp: new Date().toISOString(), color: 16763904}
				try {
					await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers: {"Content-Type": 'application/json'}, body: JSON.stringify({ embeds: [embed] })
				})} catch (e) {}
				return new Response(JSON.stringify({error :"UnAuthorized Access"}), {status: 403});
			}
		} else if (request.method === "GET") {
			return new Response(`${env.PRODUCT_NAME} Licensing System V${env.VERSION}`, {status: 302});
		}
	},
};