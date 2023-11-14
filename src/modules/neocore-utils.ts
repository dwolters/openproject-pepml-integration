import { Session } from "neo4j-driver";

export async function deleteModel(modelName: string, session: Session) {
    await session.run('MATCH (n:NeoCore__Model) WHERE n.ename = $modelName DETACH DELETE n', { modelName });
    await session.run('MATCH (n) WHERE n.enamespace = $modelName DETACH DELETE n', { modelName });
}

export async function addModel(modelName: string, metaModelName: string, session: Session) {
    // Add node for representing the model
    await session.run('CREATE (n:NeoCore__EObject:NeoCore__Model {ename:$modelName})', { modelName });
    // Attach model to respective metamodel
    await session.run(`MATCH 
                        (m:NeoCore__MetaModel {ename: $metaModelName}),
                        (n:NeoCore__Model {ename:$modelName})
                    CREATE (n)-[r:conformsTo]->(m)`,
        { modelName, metaModelName });
}