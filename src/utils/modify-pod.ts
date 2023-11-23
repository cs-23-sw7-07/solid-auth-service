import { Session } from "@inrupt/solid-client-authn-node";
import { DatasetCore } from "@rdfjs/types";
import { serializeTurtle } from "./turtle-serializer";
import { Fetch } from "solid-interoperability";

export async function insertTurtleResource(
    session: Session,
    uri: string,
    document_rdf: string,
) {
    await session
        .fetch(uri, {
            method: "PUT",
            body: document_rdf,
            headers: {
                link: '<http://www.w3.org/ns/ldp#Resource>; rel="type"',
                "Content-Type": "text/turtle",
            },
        })
        .then(res => {
            if (!res.ok) {
                return new InsertResourceError(`Couldn't insert resource at ${uri}`)
            }
        });
}

export async function createContainer(fetch: Fetch, uri_container: string) {
    const headers = new Headers({
        "Content-Type": "text/turtle",
    });

    const requestOptions: RequestInit = {
        method: "PUT",
        headers: headers,
    };

    const response = await fetch(uri_container, requestOptions);
    if (!response.ok) {
        throw new Error(`failed to create containers ${uri_container} ${response}`);
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
        ${await serializeTurtle(dataset, {
        interop: "http://www.w3.org/ns/solid/interop#",
    })}
      }
    `;
}

export async function updateContainerResource(
    session: Session,
    container_iri: string,
    dataset: DatasetCore,
) {
    const { ok } = await session.fetch(container_iri, {
        method: "PATCH",
        body: await insertPatch(dataset),
        headers: {
            "Content-Type": "application/sparql-update",
        },
    });
    if (!ok) {
        throw new Error(`failed to patch ${container_iri}`);
    }
}

export async function deleteContainerResource(
    fetch: Fetch,
    containerIRI: string 
): Promise<void> {
    const { ok } = await fetch(containerIRI, {
        method: "DELETE",
    });

    if (!ok) {
        throw new Error(`Failed to delete data at ${containerIRI}`);
    }
}


export function readResource(session: Session, url: string): Promise<string> {
    return session.fetch(url)
        .then((res) => {
            if (res.ok)
                return res.text()
            throw new ReadResourceError("Couldn't read the resource at " + url)
        });
}

class InsertResourceError extends Error {
    constructor(public message: string) {
        super(message)
    }
}

class ReadResourceError extends Error {
    constructor(public message: string) {
        super(message)
    }
}
