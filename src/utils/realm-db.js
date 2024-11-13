import * as Realm from 'realm-web';

export async function initializeDatabase(env) {
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