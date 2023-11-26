import N3, { Prefixes, Store } from "n3";
import { RDFResourceContainer } from "./rdf-document";
import { DatasetCore } from "@rdfjs/types";
import { DataRegistration, Fetch, RdfFactory } from "solid-interoperability";
import { INTEROP, data_registration } from "./namespace";
import { readParseResource } from "./utils/modify-pod";
const { quad, namedNode } = N3.DataFactory;

export class DataRegistryResource extends RDFResourceContainer {
    constructor(webId: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(webId, dataset, prefixes);
    }

    static async getResource(fetch: Fetch, uri: string): Promise<DataRegistryResource> {
        return readParseResource(fetch, uri)
            .then((result) => new DataRegistryResource(uri, result.dataset, result.prefixes));
    }

    async getHasDataRegistrations(fetch: Fetch): Promise<DataRegistration[]> {
        const values = this.getObjectValuesFromPredicate(data_registration);

        if (!values) return [];

        const factory = new RdfFactory();
        let regs = [];
        for (const uri of values) {
            const reg = await factory
                .parse(fetch, uri)
                .then((args) => DataRegistration.makeDataRegistration(args));
            regs.push(reg);
        }

        return regs;
    }

    async addHasDataRegistration(fetch: Fetch, data_registration: DataRegistration) {
        const quad_data_reg = quad(
            namedNode(this.uri),
            namedNode(INTEROP + "hasDataRegistration"),
            namedNode(data_registration.id),
        );
        const store = new Store();

        store.add(quad_data_reg);

        await this.updateResource(fetch, store).then((_) => {
            this.dataset.add(quad_data_reg);
        });
    }
}
