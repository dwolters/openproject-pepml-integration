
import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import config from 'config'
import { Buffer } from 'node:buffer'

export interface Project {
    id: number
    name: string
    description: string
}

export interface Endpoint {
    href: string
}

export interface WorkPackage {
    lockVersion?: number,
    id: number
    subject: string
    description: {
        format: "markdown" | "plain",
        raw: string,
        html: string
    },
    type?: string //does not exist by default. we resolve the dependency.
    status?: string
    priority?: string
    dueDate?: string
    _links: {
        self?: Endpoint,
        parent?: Endpoint
        status?: Endpoint
        type?: Endpoint
    }
}

export interface WorkPackageStatus {
    _type: "Status",
    id: number,
    name: string,
    position: number,
    isDefault: boolean,
    isClosed: boolean,
    isReadonly: boolean,
    color: string,
    defaultDoneRatio: number,
    _links: {
        self: Endpoint,
    }
}

export interface WorkPackageType {
    _type?: "Type",
    id: number,
    name?: string,
    color?: string,
    position?: number,
    isDefault?: boolean,
    isMilestone?: boolean,
    createdAt?: string,
    updatedAt?: string
    _links: {
        self: Endpoint,
    }
}

export class OpenProject {
    private readonly httpClient: AxiosInstance

    constructor(baseUrl: string, apiKey: string) {
        const apiKeyBase64: string = Buffer.from("apikey:" + apiKey).toString('base64')
        this.httpClient = axios.create({
            baseURL: baseUrl,
            headers: {
                Authorization: `Basic ${apiKeyBase64}`,
                'Content-Type': 'application/json'
            }
        })
    }

    async getProjects(): Promise<Project[]> {
        const response: AxiosResponse<{ _embedded: { elements: Project[] } }> = await this.httpClient.get('/api/v3/projects')
        return response.data._embedded.elements
    }

    async getProject(projectId: number): Promise<Project> {
        const response: AxiosResponse<Project> = await this.httpClient.get(`/api/v3/projects/${projectId}`)
        return response.data
    }

    async getStatuses(): Promise<WorkPackageStatus[]> {
        const response: AxiosResponse<{ _embedded: { elements: WorkPackageStatus[] } }> = await this.httpClient.get('/api/v3/statuses')
        return response.data._embedded.elements
    }

    async getWorkPackageTypes(): Promise<WorkPackageType[]> {
        const response: AxiosResponse<{ _embedded: { elements: WorkPackageType[] } }> = await this.httpClient.get('/api/v3/types')
        return response.data._embedded.elements
    }

    async createProject(name: string, description: string): Promise<Project> {
        const response: AxiosResponse<Project> = await this.httpClient.post('/api/v3/projects', {
            name,
            description
        })
        return response.data
    }

    async getWorkPackages(projectId: number): Promise<WorkPackage[]> {
        const filter = [
            {

                "status_id": {
                    "operator": "=",
                    "values": ["12"]
                },
            }
        ]
        const filterStr = "filter=" + encodeURIComponent(JSON.stringify(filter));
        const response: AxiosResponse<{ _embedded: { elements: WorkPackage[] } }> = await this.httpClient.get(`/api/v3/projects/${projectId}/work_packages`)
        return response.data._embedded.elements
    }
    async createWorkPackage(projectId: number, subject: string, typeId: number, statusId?: number, parentWorkPackageId?: number): Promise<WorkPackage> {
        let props: Partial<WorkPackage> = {
            subject,
            _links: {
                type: { href: `/api/v3/types/${typeId}` }
            }
        };
        if (statusId)
            props._links.status = { href: `/api/v3/statuses/${statusId}` };
        if (parentWorkPackageId)
            props._links.parent = { href: `/api/v3/work_packages/${parentWorkPackageId}` };
        const response: AxiosResponse<WorkPackage> = await this.httpClient.post(`/api/v3/projects/${projectId}/work_packages`, props)
        return response.data
    }

    async createTask(projectId: number, subject: string, statusId?: number, parentWorkPackageId?: number): Promise<WorkPackage> {
        return this.createWorkPackage(projectId, subject, 1, statusId, parentWorkPackageId);
    }

    async updateWorkPackageProperties(workPackageId: number, properties: Partial<WorkPackage>): Promise<WorkPackage> {
        let workPackage = await this.getWorkPackage(workPackageId);
        const response: AxiosResponse<WorkPackage> = await this.httpClient.patch(`/api/v3/work_packages/${workPackageId}`, {
            ...properties,
            lockVersion: workPackage.lockVersion,
            id: workPackageId
        })
        return response.data
    }

    async updateWorkPackageParent(workPackageId: number, parentWorkPackageId: number) {
        return this.updateWorkPackageProperties(workPackageId, { _links: { parent: { href: `/api/v3/work_packages/${parentWorkPackageId}` } } });
    }

    async updateWorkPackageStatus(workPackageId: number, statusId: number) {
        return this.updateWorkPackageProperties(workPackageId, { _links: { status: { href: `/api/v3/statuses/${statusId}` } } });
    }

    async deleteWorkPackage(workPackageId: number): Promise<void> {
        return this.httpClient.delete(`/api/v3/work_packages/${workPackageId}`)
    }

    async getWorkPackage(workPackageId: number): Promise<WorkPackage> {
        const response: AxiosResponse<WorkPackage> = await this.httpClient.get(`/api/v3/work_packages/${workPackageId}`)
        return response.data;
    }

    hrefToId(href: string) {
        const matches = href.match(/\d+$/);
        if (matches && matches.length > 0) {
            return parseInt(matches[0]);
        }
        return null;
    }
}

export default new OpenProject(config.get('openprojectUrl'), config.get('apiKey'));
