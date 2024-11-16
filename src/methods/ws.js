import { parseLicenseResponse } from '../utils/parser';
import { initializeDatabase } from '../utils/realm-db';

export async function LicenseWS(ip, env) {
  const webSocketPair = new WebSocketPair();
  const [ws_client, ws_server] = Object.values(webSocketPair);
  ws_server.accept();
  ws_client.total_pings = 0
  ws_client.user_id = null
  ws_client.version = null
  ws_client.session_id = null
  ws_client.machine_id = null
  const { OnlineLicenses } = await initializeDatabase(env)

  if (OnlineLicenses == null) {
    return { response: new Response(JSON.stringify({ error: 'Database Error' }), { status: 500 }) }
  }

  ws_server.addEventListener('message', async (event) => {
    const ws_data = JSON.parse(event.data)
    if (ws_data?.event == 'keepalive') {
      const parsedLicense = parseLicenseResponse(ws_data)
      ws_client.user_id = parsedLicense.user_id
      ws_client.version = parsedLicense.version
      ws_client.session_id = parsedLicense.session_id
      ws_client.machine_id = parsedLicense.machine_id
      const previousConnection = await OnlineLicenses.findOne({ session_id: ws_client.session_id }) || {}
      if ((ws_client?.total_pings > 0) && (previousConnection?.session_id != ws_client?.session_id)) {
        ws_server.send(JSON.stringify({ event: 'killconn' }))
        if (ws_client?.session_id != null) {
          await OnlineLicenses.deleteOne({ session_id: ws_client.session_id, product_id: env.PRODUCT_ID })
        }
        console.log("Closing due to Multiple Connections", ws_client?.session_id, ws_client?.user_id)
        return ws_server.close(1008, "Closing the Connection due to Multiple Connections")
      }
      await OnlineLicenses.updateOne({ session_id: ws_client.session_id }, { ...previousConnection, user_id: ws_client.user_id, product_id: env.PRODUCT_ID, version: ws_client.version, time: new Date(), ip: ip, session_id: ws_client.session_id }, { upsert: true })
      ws_server.send(JSON.stringify({ event: 'keepalive', keepalive: (previousConnection?.keepalive == null) ? env.WS_KEEPALIVE : previousConnection?.keepalive, guild_ids: previousConnection?.guild_ids || [] }))
      ws_client.total_pings += 1
    }
  });

  ws_server.addEventListener('close', async () => {
    console.log("Closing the Connection", ws_client?.session_id, ws_client?.user_id)
    if (ws_client?.session_id != null) {
      console.log("Closing the Connection and Cleaning the DB", ws_client?.session_id, ws_client?.user_id)
      try {
        await OnlineLicenses.deleteOne({ session_id: ws_client.session_id, product_id: env.PRODUCT_ID })
      } catch (error) {
        console.log("Error in WS Connection Close", ws_client?.session_id, ws_client?.user_id, error)
      }
    }
    ws_server.close(1000, "Closing the License Websocket Connection")
  });

  ws_server.addEventListener('error', async () => {
    if (ws_client?.session_id != null) {
      try {
        await OnlineLicenses.deleteOne({ session_id: ws_client.session_id, product_id: env.PRODUCT_ID })
      } catch (error) {
        console.log("Error in WS Connection Close(Error)", ws_client?.session_id, ws_client?.user_id, error)
      }
    }
    console.log("Error in WS Connection", ws_client?.session_id, ws_client?.user_id)
  });

  return { ws_client, ws_server, error: null }
}