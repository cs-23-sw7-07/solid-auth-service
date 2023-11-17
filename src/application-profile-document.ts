import N3 from "n3";
import { DatasetCore } from "@rdfjs/types";
import { AccessMode, Fetch } from "solid-interoperability";
import { parseTurtle } from "./utils/turtle-parser";
const { Store, DataFactory } = N3;
const { namedNode } = DataFactory

export class ApplicationProfileDocument { 
    constructor(public webId : string, public dataset : DatasetCore) {
        
    }

    gethasAccessNeedGroup(): string | undefined{
        const quads = this.dataset.match(null, namedNode("http://www.w3.org/ns/solid/interop#hasAccessNeedGroup"));
        for (const quad of quads) {
            return quad.object.value
        }
        return undefined
    }

    async gethasAccessNeeds(fetch: Fetch, hasAccessNeedGroup: string): Promise<AccessNeed[]> {
        const quads = this.dataset.match(namedNode(hasAccessNeedGroup), namedNode("http://www.w3.org/ns/solid/interop#interop:hasAccessNeed"));
        const accessList: AccessNeed[] = [];
        for (const quad of quads) {
            const data: DatasetCore = await fetch(quad.object.value).then(res => res.text()).then(res => parseTurtle(res))
            new AccessNeed(quad.object.value, data);
            accessList.push()
        }
        return accessList;
    }

}

export class AccessNeed {
    getCreatorAccessMode(): import("solid-interoperability").AccessMode[] | undefined {
        throw new Error("Method not implemented.");
    }
    getRegistratedShapeTree(): string {
        throw new Error("Method not implemented.");
    }
    constructor(public id : string, public dataset : DatasetCore) {
        
    }

    getAccessModes(): AccessMode[]{
        const quads = this.dataset.match(namedNode(this.id), namedNode("http://www.w3.org/ns/solid/interop#interop:hasAccessNeed"));
        const accessModes = []
        for (const quad of quads) {
            // return getAccessmode(quad.object.value)
        }
        return []; //NOT IMPLEMENTET YET
    }


}