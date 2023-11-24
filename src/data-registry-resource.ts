import N3, { Prefixes } from "n3";
import { RdfDocument } from "./rdf-document";
import { DatasetCore } from "@rdfjs/types";
import { parseTurtle } from "./utils/turtle-parser";
import { DataRegistration, Fetch, RdfFactory } from "solid-interoperability";
import { data_registration } from "./namespace";
import { updateContainerResource } from "./utils/modify-pod";
const { quad, namedNode} = N3.DataFactory;

export class DataRegistryResource extends RdfDocument {
    constructor(webId: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(webId, dataset, prefixes);
    }

    static async getResource(
        uri: string,
    ): Promise<DataRegistryResource> {
        return fetch(uri)
            .then((res) => res.text())
            .then((res) => parseTurtle(res, uri))
            .then(
                (result) =>
                    new DataRegistryResource(
                        uri,
                        result.dataset,
                        result.prefixes,
                    ),
            );
    }

    async getHasDataRegistrations(fetch: Fetch): Promise<DataRegistration[]> {
        const values = this.getObjectValuesFromPredicate(
            data_registration,
        );

        if (!values)
            return [];
        
        const factory = new RdfFactory()
        let regs = [];
        for (const uri of values) {
            const reg = await fetch(uri)
            .then(res => res.text())
            .then(res => factory.parse(fetch, res))
            .then(args => DataRegistration.makeDataRegistration(args))
            regs.push(reg)
        }

        return regs;
    }

    async addHasDataRegistration(fetch: Fetch, data_registration: DataRegistration) {
        this.dataset.add(quad(namedNode(this.uri), namedNode("interop:hasDataRegistration"), namedNode(data_registration.id)))
        await this.updateResource(fetch)
    }

    private async updateResource(fetch: Fetch) {
        updateContainerResource(fetch,
            this.uri + ".meta",
            this.dataset,
        );
    }
}
