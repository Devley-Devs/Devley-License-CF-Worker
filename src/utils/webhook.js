export async function executeDiscordWebhook(parsedLicense, ip, description, color, env) {
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
  } catch (error) {
    console.log("Error sending Webhook log", error)
  }
}