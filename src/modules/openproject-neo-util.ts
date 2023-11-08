import OpenProject, { WorkPackageStatus, WorkPackageType } from "./openproject";
import { getSession, closeSession } from "./neo";
import { Session } from "neo4j-driver";
import { addModel, deleteModel } from "./neocore-utils";

export async function exportProject(projectId: number, modelName: string) {
    await deleteModel(modelName);
    await addModel(modelName, 'OpenProject');
    const session = getSession('export project');
    try {
        await addProject(projectId, modelName, session);
        await addStatuses(modelName, session);
        //await addWorkPackageTypes(modelName, session);
        await addWorkPackages(3, modelName, session);
        console.log("exported");
    } finally {
        console.log("should close");
        await closeSession();
    }
}

async function addStatuses(modelName: string, session: Session) {
    const statuses = await OpenProject.getStatuses();
    return addObjects(statuses, ['id', 'name', 'isClosed'], 'OpenProject__Status', modelName, session);
}

async function addProject(projectId: number, modelName: string, session: Session) {
    const project = await OpenProject.getProject(projectId);
    return addObjects([project], ['id', 'name'], 'OpenProject__Project', modelName, session);
}

async function addWorkPackageTypes(modelName: string, session: Session) {
    const types = await OpenProject.getWorkPackageTypes();
    return addObjects(types, ['id', 'name'], 'OpenProject__Type', modelName, session);
}

async function addWorkPackages(projectId: number, modelName: string, session: Session) {
    let wps = await OpenProject.getWorkPackages(projectId);
    let types = await OpenProject.getWorkPackageTypes()
    wps.forEach(wp => wp.type = types.find(t => t.id == OpenProject.hrefToId(wp._links.type?.href)).name);
    await addObjects(wps, ['id', 'subject','type'], 'OpenProject__WorkPackage', modelName, session);
    let relationships = [];
    wps.filter(wp => wp._links?.parent?.href).forEach(wp => relationships.push({ name: 'parent', sourceId: wp.id, sourceLabel: 'OpenProject__WorkPackage', targetId: OpenProject.hrefToId(wp._links.parent?.href), targetLabel: 'OpenProject__WorkPackage' }));
    wps.filter(wp => wp._links?.status?.href).forEach(wp => relationships.push({ name: 'status', sourceId: wp.id, sourceLabel: 'OpenProject__WorkPackage', targetId: OpenProject.hrefToId(wp._links.status?.href), targetLabel: 'OpenProject__Status' }));
    //wps.filter(wp => wp._links?.type?.href).forEach(wp => relationships.push({ name: 'type', sourceId: wp.id, sourceLabel: 'OpenProject__WorkPackage', targetId: OpenProject.hrefToId(wp._links.type?.href), targetLabel: 'OpenProject__WorkPackageType' }));
    await session.run(`
            UNWIND $relationships AS r
            MATCH (s {enamespace: $modelName})
            WHERE s.id = r.sourceId AND r.sourceLabel IN labels(s)
            MATCH (t {enamespace: $modelName})
            WHERE t.id = r.targetId AND r.targetLabel IN labels(t)
            CALL apoc.create.relationship(s, r.name, NULL, t) YIELD rel
            RETURN rel
        `, { modelName, relationships })
    let generalRelationships = [
        {name: "statuses", label: "OpenProject__Status"},
        {name: "types", label: "OpenProject__Type"},
        {name: "workPackages", label: "OpenProject__WorkPackage"}
    ];
    await session.run(`
            UNWIND $generalRelationships AS r
            MATCH (p:OpenProject__Project {id: $projectId, enamespace: $modelName})
            MATCH (c {enamespace: $modelName})
            WHERE r.label IN labels(c)
            CALL apoc.create.relationship(p, r.name, NULL, c) YIELD rel
            RETURN rel
        `, { projectId, modelName, generalRelationships })
}

async function addObjects(objects: any, properties: string[], labels: string | string[], modelName: string, session: Session) {
    if (!Array.isArray(labels))
        labels = [labels];
    labels.unshift('NeoCore__Object');
    let query = `
        UNWIND $objects AS object
        CREATE (n:${labels.join(':')} {enamespace: $modelName})
    `;
    if (properties && Array.isArray(properties) && properties.length)
        query += 'SET ' + properties.map(p => `n.${p} = object.${p}`).join(',');
    return session.run(query, { modelName, objects });
}