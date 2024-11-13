export function parseLicenseResponse(request_body) {
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