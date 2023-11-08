import { getSession, closeSession } from "./neo";
import { deleteModel } from './neocore-utils';

let commonalities = [
    "a.name = b.name",
    "(a:PEPML__EducationProgramme AND b:PEPML__EducationProgramme)"
]

export type CommonEntities = Array<{ aId: number, bId: number, labels: string[], properties: NodeProperties }>;
export type NodeProperties = Record<string, number | string | boolean | number[] | string[] | boolean[]>;

export async function identifyCommonEntities(modelA: string, modelB: string) {
    const session = getSession('identifyCommonEntities');
    let commonEntities: CommonEntities = [];
    try {
        let results = await session.run(`
        MATCH (a {enamespace: $modelA}),(b {enamespace: $modelB})
        WHERE ${commonalities.join(' OR ')}
        RETURN a.name as name, id(a) AS aId, id(b) AS idB, labels(a) as aLabels, labels(b) as bLabels, properties(a) as aProps, properties(b) AS bProps
    `, { modelA, modelB });
        for (let i = 0; i < results.records.length; i++) {
            let record = results.records[i];
            let name = record.get<string>("name");
            let aLabels = record.get("aLabels") as string[];
            let bLabels = record.get("bLabels") as string[];
            let aId = record.get("aId") as number;
            let bId = record.get("aId") as number;
            let aProps = record.get("aProps") as NodeProperties;
            let bProps = record.get("bProps") as NodeProperties;
            console.log('Common entity:', name);
            try {
                let labels = checkTypeCompatability(aLabels, bLabels);
                let properties = checkPropertyCompatibility(aProps,bProps);
                commonEntities.push({ aId, bId, labels, properties })
            } catch (e) {
                console.warn(e);
            }
        }
        console.log(JSON.stringify(commonEntities,null, 2))
    } finally {
        await closeSession();
    }
}

function checkTypeCompatability(aLabels: string[], bLabels: string[]) {
    let uniqueALabels = aLabels.filter(l => !bLabels.includes(l))
    let uniqueBLabels = bLabels.filter(l => !aLabels.includes(l))
    if (uniqueALabels.length && uniqueBLabels.length) {
        throw new Error("Discarding match of common entities due to type incompatibility");
    }
    return uniqueALabels.length ? aLabels : bLabels;
}

function checkPropertyCompatibility(aProps: NodeProperties, bProps:NodeProperties) {
    let commonProps : NodeProperties = {};
    const ignoreProperties = ['__created', 'enamespace']
    commonProps['__created'] = aProps['__created'].concat(bProps['__created'])
    commonProps['enamespace'] = bProps['enamespace']
    let keys = Object.keys(aProps).concat(Object.keys(bProps)).filter((value, index, array) => array.indexOf(value) === index);
    console.log('Keys:',keys)
    for(let key of keys) {
        if(ignoreProperties.includes(key) || key.match(/^__created_/)) continue;
        console.log(key)
        if(aProps[key] && bProps[key] && aProps[key] != bProps[key])
            throw new Error(`Property ${key} contains mismatching values: '${aProps[key] }' != '${bProps[key]}'`)
        if(Array.isArray(aProps['__created_' + key]) && Array.isArray(bProps['__created_' + key])) {
            commonProps['__created_' + key] = aProps['__created_' + key].concat(bProps['__created_' + key])
        } else if(Array.isArray(aProps['__created_' + key])) {
            commonProps['__created_' + key] = aProps['__created_' + key]
        } else if(Array.isArray(bProps['__created_' + key])) {
            commonProps['__created_' + key] = bProps['__created_' + key]
        }
        if(aProps[key])
            commonProps[key] = aProps[key];
        else
            commonProps[key] = bProps[key];
    }
    return commonProps
}

export async function mergeInto(sourceModelName: string, targetModelName: string, commonEntities: CommonEntities) {
    try {
        const session = getSession('copy model')

        console.log(`Copying ${sourceModelName} to ${targetModelName}`);
        // Deleting the source model
        await session.run('MATCH (n:NeoCore__EObject:NeoCore__Model {ename:$sourceModelName}) DETACH DELETE n ', { sourceModelName });
        // Merge common entities
        await session.run(`UNWIND commonEntities as commonEntity
                MATCH (a {enamespace: $sourcemodelName}),
                (b {enamespace:$targetModelName})
                WHERE id(a) = commonEntity.idA AND id(b) = commonEntity.idB
                SET b = commonEntities.properties
                WITH a,b 
                MATCH (n)-[r]->(a)
                MERGE (n)-[r]->(b)
                WITH a,b 
                MATCH (n)<-[r]-(a)
                MERGE (n)<-[r]->(b)
                WITH a,b
                DETACH DELETE a
                WITH b
                CALL apoc.create.setLabels( b, commonEntity.labels )
                YIELD node
                RETURN node;`,
            { commonEntities, sourceModelName, targetModelName });
        await session.run(`MATCH 
                      (s {enamespace:$sourceModelName})
                      SET s.enamespace = $targetModelName
                      `,
            { sourceModelName, targetModelName });
        // await session.run(`MATCH 
        //         (s1 {enamespace:$sourceModelName})-[sr]->(s2 {enamespace:$sourceModelName})
        //         MATCH (t1 {_copyOf_: id(s1), enamespace: $targetModelName}), (t2 {_copyOf_: id(s2), enamespace: $targetModelName})
        //         CALL apoc.create.relationship(t1, type(sr), properties(sr), t2)
        //         YIELD rel
        //         RETURN rel
        //         `,
        //     { sourceModelName, targetModelName });
        // await session.run('MATCH (n {enamespace: $targetModelName}) REMOVE n._copyOf_', { targetModelName });
    } finally {
        await closeSession();
    }
}
