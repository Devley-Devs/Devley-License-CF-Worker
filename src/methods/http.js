import { ObjectId } from 'bson';
import { parseLicenseResponse } from '../utils/parser';
import { initializeDatabase } from '../utils/realm-db';
import { executeDiscordWebhook } from '../utils/webhook';

export async function LicenseHTTP(request, ip, env) {
  if (!(request.headers.get("Authorization") === `Bearer ${env.AUTHORIZATION_HEADER}`)) {
    const request_body = await request.json()
    const parsedLicense = parseLicenseResponse(request_body)
    if ((parsedLicense.transaction_id == null) && (parsedLicense.user_id == null)) {
      return new Response(JSON.stringify({ error: 'License Key is in Wrong Format' }), { status: 403 });
    }
    const { Licenses, Products, ProductActivities, OnlineLicenses } = await initializeDatabase(env);
    if (Licenses == null) {
      return new Response(JSON.stringify({ error: 'Database Error' }), { status: 500 })
    }
    const licenses = await Licenses.findOne({ _id: String(parsedLicense.user_id) })
    const db_data = licenses?.products[env.PRODUCT_ID]
    if ((db_data == null) || (db_data?.transaction_id != parsedLicense.transaction_id) || (db_data?.misc?.uuid != parsedLicense.uuid)) {
      await executeDiscordWebhook(parsedLicense, ip, "### `❌` Invalid License Key Passed", 16390168, env)
      console.log("Invalid License Key", JSON.stringify(request_body))
      return new Response(JSON.stringify({ error :"License Key Not Found" }), { status: 404 });
    } else if (db_data?.blocked) {
      if (String(env.OWNER_ID) != String(parsedLicense.user_id)) {
        await ProductActivities.insertOne({ user_id: parsedLicense.user_id, product_id: env.PRODUCT_ID, version: parsedLicense.version, time: new Date(), ip: ip, session_id: parsedLicense.session_id, machine_id: parsedLicense.machine_id, status: '⛔' })
        await executeDiscordWebhook(parsedLicense, ip, "### `⛔` Blocked License Key", 16390168, env)
        console.log("Blocked the License Key", JSON.stringify(request_body))
      }
      return new Response(JSON.stringify({ error :"License Key has been Blocked" }), { status: 402 });
    } else {
      if (String(env.OWNER_ID) != String(parsedLicense.user_id)) {
        await ProductActivities.insertOne({ user_id: parsedLicense.user_id, product_id: env.PRODUCT_ID, version: parsedLicense.version, time: new Date(), ip: ip, session_id: parsedLicense.session_id, machine_id: parsedLicense.machine_id, status: '✅' })
        await executeDiscordWebhook(parsedLicense, ip, "### `✅` Successfully sent the License Key", env.COLOR, env)
      }
      await OnlineLicenses.deleteMany({ user_id: parsedLicense.user_id, product_id: env.PRODUCT_ID })
      await OnlineLicenses.insertOne({ user_id: parsedLicense.user_id, product_id: env.PRODUCT_ID, version: parsedLicense.version, connectedTime: new Date(), time: new Date(), ip: ip, keepalive: env.WS_KEEPALIVE, session_id: parsedLicense.session_id, machine_id: parsedLicense.machine_id, guild_ids: db_data?.misc?.guild_ids || [] })
      var product = await Products.findOne({ _id: new ObjectId(env.PRODUCT_ID) }) || Object()
      delete product.link
      console.log("Sent the License Key", JSON.stringify(request_body))
      return new Response(JSON.stringify({ license_key: db_data.license_key, product: product }), { status: 200 });
    }
  } else {
    await executeDiscordWebhook(parsedLicense, ip, "### `⚠️` UnAuthorized Access to the Licence Server", 16763904, env)
    console.log("UNAUTHORIZED ACCESS", ip)
    return new Response(JSON.stringify({ error :"UnAuthorized Access" }), { status: 403 });
  }
}