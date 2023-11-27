import N3, { Prefixes, Store } from "n3";
import { RDFResourceContainer } from "./rdf-document";
import { DatasetCore } from "@rdfjs/types";
import { DataRegistration, Fetch, RdfFactory } from "solid-interoperability";
import { INTEROP, DATA_REGISTRATION } from "./namespace";
const { quad, namedNode } = N3.DataFactory;

export class DataRegistryResource extends RDFResourceContainer {
    constructor(webId: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(webId, dataset, prefixes);
    }

    async getHasDataRegistrations(fetch: Fetch): Promise<DataRegistration[]> {
        const values = this.getObjectValuesFromPredicate(DATA_REGISTRATION);

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

    async addHasDataRegistration(fetch: Fetch, dataRegistration: DataRegistration) {
        const quadDataReg = quad(
            namedNode(this.uri),
            namedNode(INTEROP + "hasDataRegistration"),
            namedNode(dataRegistration.id),
        );
        const store = new Store();

        store.add(quadDataReg);

        await this.updateResource(fetch, store).then((_) => {
            this.dataset.add(quadDataReg);
        });
    }
}
