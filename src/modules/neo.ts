import neo4j, { Session } from 'neo4j-driver';
import config from 'config';

const driver = neo4j.driver(
    config.get("connectionUri"),
    neo4j.auth.basic(config.get("username"), config.get("password")),
    { disableLosslessIntegers: true }
);

let session : Session;

export function getSession(name: string): Session {
    if (session === undefined) {
        console.log('creating session for :', name);
        session = driver.session();
    } else {
        console.log('Session already exist: ', name)
    }
    return session;
}

export async function closeSession(): Promise<void> {
    let promise = session.close();
    session = undefined;
    return promise;
}

export async function closeConnection(): Promise<void> {
    driver.close();
}