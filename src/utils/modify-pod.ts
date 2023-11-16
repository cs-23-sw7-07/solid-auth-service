import LinkHeader from 'http-link-header';
import N3 from "n3";
import {
    Session,
} from "@inrupt/solid-client-authn-node";
import { DatasetCore } from "@rdfjs/types";
import { serializeTurtle } from "./turtle-serializer";

const { Store, Parser, DataFactory } = N3;
const { namedNode } = DataFactory

export const type_a = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")

// export async function insertFile(session: Session, uri: string, profile: DatasetCore) {
//     await session.fetch(uri, {
//         method: "POST",
//         headers: {
//             "Content-Type": "text/turtle"
//         }
//     }).then(console.log);
// }

export async function createContainer(session: Session, uri_container: string) {
    const headers = new Headers({
        'Content-Type': 'text/turtle',
    });

    const requestOptions: RequestInit = {
        method: 'PUT',
        headers: headers,
    };

    const response = await session.fetch(uri_container, requestOptions);
    if (!response.ok) {
        throw new Error(`failed to create containers ${uri_container}`);
    }
}


// export function getDescriptionResource(linkHeaderText: string): string | undefined {
//     const links = LinkHeader.parse(linkHeaderText).refs;
//     return links.find((link) => link.rel === 'describedby')?.uri;
//   }

// export async function discoverDescriptionResource(session : Session, iri : string): Promise<string> {
//     const headResponse = await session.fetch(iri, {
//       method: 'HEAD'
//     });

//     return getDescriptionResource(headResponse.headers.get('Link')!)!;
//   }

async function insertPatch(dataset: DatasetCore): Promise<string> {
    return `
      INSERT DATA {
        ${await serializeTurtle(dataset, { "interop": "http://www.w3.org/ns/solid/interop#" })}
      }
    `;
}


export async function updateContainer(session: Session, container_iri: string, dataset: DatasetCore) {
    const { ok } = await session.fetch(container_iri, {
        method: 'PATCH',
        body: await insertPatch(dataset),
        headers: {
            'Content-Type': 'application/sparql-update'
        }
    });
    if (!ok) {
        throw new Error(`failed to patch ${container_iri}`);
    }
}