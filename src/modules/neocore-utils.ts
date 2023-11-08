import { getSession, closeSession } from "./neo";

export async function getAttributes(types: string[]) {
    let attributeTypes = [];
    const session = getSession('getAttributes');
    try {
        let results = await session.run(`
        MATCH (n:NeoCore__EClass)-[:eAttributes]->(a)-[:eAttributeType]->(t)
        WHERE n.ename IN $types
        RETURN a.ename AS name, t.ename AS type
    `, { types });
        for (let i = 0; i < results.records.length; i++) {
            let record = results.records[i];
            let name = record.get<string>("name");
            let type = record.get<string>("type");
            let typeMap: { [id: string]: string } = {
                "EString": "string",
                "EBoolean": "boolean",
                "EInt": "number",
                "EDouble": "number",
            }
            if (!typeMap[type]) throw new Error('Unknown type');
            type = typeMap[type];
            attributeTypes.push({ name, type });
        }
        return attributeTypes;
    } finally {
        await closeSession();
    }
}

export async function getSubclasses(type: string): Promise<string[]> {
    const session = getSession('get subclasses');
    try {
        let results = await session.run(`
            MATCH (n)<-[:eSuperType*]-(connectedNode)
            WHERE n.ename = $type
            RETURN connectedNode.ename AS name
        `, { type });

        return results.records.map(r => r.get<string>('name'));
    } finally {
        await closeSession();
    }
}

export async function deleteModel(modelName: string) {
    const session = getSession('delete model');
    try {
        await session.run('MATCH (n:NeoCore__Model) WHERE n.ename = $modelName DETACH DELETE n', { modelName });
        await session.run('MATCH (n) WHERE n.enamespace = $modelName DETACH DELETE n', { modelName });

    } finally {
        await closeSession();
    }
}

export async function addModel(modelName: string, metaModelName: string) {
    const session = getSession('add model');
    try {
        // Add node for representing the model
        await session.run('CREATE (n:NeoCore__EObject:NeoCore__Model {ename:$modelName})', { modelName });
        // Attach model to respective metamodel
        await session.run(`MATCH 
                        (m:NeoCore__MetaModel {ename: $metaModelName}),
                        (n:NeoCore__Model {ename:$modelName})
                    CREATE (n)-[r:conformsTo]->(m)`,
            { modelName, metaModelName });
    } finally {
        await closeSession();
    }
}


export async function deleteCreateFlag(modelName: string) {
    const session = getSession('delete create flag');
    try {
        // Remove all _cr_ properties on already extracted items.
        await session.run('MATCH (n) WHERE n.enamespace = $modelName and n.`_cr_`=true REMOVE n.`_cr_`', { modelName })
        await session.run('MATCH (n)-[r]->(m) WHERE n.enamespace = $modelName AND m.enamespace=n.enamespace and r.`_cr_`=true REMOVE r.`_cr_`', { modelName })
    } finally {
        await closeSession();
    }
}

export async function copyModel(sourceModelName: string, targetModelName: string) {
    console.log('Deleting: ', targetModelName);
    await deleteModel(targetModelName);

    try {
        const session = getSession('copy model')

        console.log(`Copying ${sourceModelName} to ${targetModelName}`);
        // Add node for representing the model
        await session.run('MERGE (n:NeoCore__EObject:NeoCore__Model {ename:$targetModelName})', { targetModelName });
        // Attach model to respective metamodel
        await session.run(`MATCH 
                (m:NeoCore__MetaModel {ename: "Miro"}),
                (n:NeoCore__Model {ename:$targetModelName})
                MERGE (n)-[r:conformsTo]->(m)`,
            { targetModelName });
        await session.run(`MATCH 
                      (s {enamespace:$sourceModelName})
                      CREATE (t)
                      SET t = s, t.enamespace = $targetModelName, t._copyOf_ = id(s)
                      WITH s,t
                      CALL apoc.create.addLabels(id(t),labels(s))
                      YIELD node
                      RETURN node
                      `,
            { sourceModelName, targetModelName });
        await session.run(`MATCH 
                (s1 {enamespace:$sourceModelName})-[sr]->(s2 {enamespace:$sourceModelName})
                MATCH (t1 {_copyOf_: id(s1), enamespace: $targetModelName}), (t2 {_copyOf_: id(s2), enamespace: $targetModelName})
                CALL apoc.create.relationship(t1, type(sr), properties(sr), t2)
                YIELD rel
                RETURN rel
                `,
            { sourceModelName, targetModelName });
        await session.run('MATCH (n {enamespace: $targetModelName}) REMOVE n._copyOf_', { targetModelName });
    } finally {
        await closeSession();
    }
}

export async function copyCorrespondences(originalSourceModelName: string, originalTargetModelName: string, copySourceModelName: string, copyTargetModelName: string) {
    try {
        const session = getSession('copy correspondences')
        await session.run(`MATCH 
                (s1 {enamespace:$originalSourceModelName})-[sr:corr]->(s2 {enamespace:$originalTargetModelName})
                MATCH (t1 {ename:s1.ename, enamespace: $copySourceModelName}), (t2 {ename:s2.ename, enamespace: $copyTargetModelName})
                CREATE (t1)-[tr:corr]->(t2)
                SET tr._type_ = sr._type_
                `,
            { originalSourceModelName, originalTargetModelName, copySourceModelName, copyTargetModelName });
    } finally {
        await closeSession();
    }
}

export async function compareModels(originalModelName: string, alteredModelName: string) {
    const session = getSession('compare models');
    try {
        // Mark all nodes with _cr_ which are in altered model but not in original model
        await session.run(`MATCH (n)
                           WHERE n.enamespace = $alteredModelName
                           AND NOT EXISTS {
                                MATCH ({ename: n.ename, enamespace: $originalModelName})
                           }
                           SET n._cr_ = true`, { originalModelName, alteredModelName });
        // Mark all relationships with _cr_ which are in altered model but not in original model
        await session.run(`MATCH (s)-[r]->(t)
                           WHERE s.enamespace = $alteredModelName AND t.enamespace = s.enamespace
                           AND NOT EXISTS {
                                MATCH ({ename: s.ename, enamespace: $originalModelName})-[nr]->({ename: t.ename, enamespace: $originalModelName})
                                WHERE type(nr) = type(r)
                           }
                           SET r._cr_ = true`, { originalModelName, alteredModelName });
        // Add deleted nodes
        await session.run(`MATCH (o)
                           WHERE o.enamespace = $originalModelName
                           AND NOT EXISTS {
                                MATCH ({ename: o.ename, enamespace: $alteredModelName})
                           }
                           CREATE (t)
                           SET t = o, t._de_ = true, t.enamespace = $alteredModelName
                           WITH t,o
                           CALL apoc.create.addLabels(id(t),labels(o))
                           YIELD node
                           RETURN node
                           `, { originalModelName, alteredModelName });
        // Add deleted relationships
        await session.run(`MATCH 
                        (s1 {enamespace:$originalModelName})-[sr]->(s2 {enamespace:$originalModelName})
                        MATCH (t1 {ename:s1.ename, enamespace: $alteredModelName}), (t2 {ename:s2.ename, enamespace: $alteredModelName})
                        WHERE NOT EXISTS {                            
                            MATCH (t1)-[nr]->(t2) WHERE type(nr) = type(sr)
                        }
                        CALL apoc.create.relationship(t1, type(sr), properties(sr), t2)
                        YIELD rel
                        SET rel._de_ = true
                        RETURN rel`, { originalModelName, alteredModelName });

    } finally {
        await closeSession();
    }
}