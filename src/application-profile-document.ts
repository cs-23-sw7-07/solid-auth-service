import N3 from "n3";
import { DatasetCore } from "@rdfjs/types";
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

    gethasAccessNeeds(hasAccessNeedGroup: string) {
        const quads = this.dataset.match(namedNode(hasAccessNeedGroup), namedNode("http://www.w3.org/ns/solid/interop#interop:hasAccessNeed"));
        for (const quad of quads) {
            return quad.object.value
        }
        return undefined
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

    getAccessModes(){
        const quads = this.dataset.match(namedNode(this.id), namedNode("http://www.w3.org/ns/solid/interop#interop:hasAccessNeed"));
        const accessModes = []
        for (const quad of quads) {
            // return getAccessmode(quad.object.value)
        }
    }


}