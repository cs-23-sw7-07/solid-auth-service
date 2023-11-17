import LinkHeader from 'http-link-header';
import N3 from "n3";
import {
    Session,
} from "@inrupt/solid-client-authn-node";
import { DatasetCore } from "@rdfjs/types";
import { serializeTurtle } from "./turtle-serializer";
import { parseTurtle } from './turtle-parser';

const { Store, Parser, DataFactory } = N3;
const { namedNode } = DataFactory

export const type_a = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")

const getItemName = (url: string) => {
    return url.substr(url.lastIndexOf('/') + 1)
  }
  

export async function insertTurtleResource(session: Session, uri: string, document_rdf: string) {
    await session.fetch(uri, {
        method: "POST",
        body: document_rdf,
        headers: {
            slug: getItemName(uri),
            "link": '<http://www.w3.org/ns/ldp#Resource>; rel="type"',
            "Content-Type": "text/turtle"
        }
    }).then(console.log);
}

export async function createContainer(session: Session, uri_container: string) {
    const response = await session.fetch(uri_container, {
        method: 'PUT',
        headers: {
            "Content-Type": "text/turtle"
        }
    });
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


export async function updateContainerResource(session: Session, container_iri: string, dataset: DatasetCore) {
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


class ContainerInfo {
    constructor(public containers : string[], public resources : string[]) {
    }
}

export function readContainer(session: Session, url: string): Promise<string> {
    return session.fetch(url)
                    .then(res => res.text())
}