import { DatasetCore } from "@rdfjs/types";
import { serializeTurtle } from "./turtle-serializer";
import { Fetch } from "solid-interoperability";
import { ParserResult, parseTurtle } from "./turtle-parser";

export async function insertTurtleResource(fetch: Fetch, uri: string, document_rdf: string) {
    await fetch(uri, {
        method: "PUT",
        body: document_rdf,
        headers: {
            link: '<https://www.w3.org/ns/ldp#Resource>; rel="type"',
            "Content-Type": "text/turtle",
        },
    }).then((res) => {
        if (!res.ok) {
            return new InsertResourceError(`Couldn't insert resource at ${uri}`);
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
      PREFIX interop: <http://www.w3.org/ns/solid/interop#>
      INSERT DATA {
        ${await serializeTurtle(dataset, {})}
      }
    `;
}

export async function updateContainerResource(
    fetch: Fetch,
    container_iri: string,
    dataset: DatasetCore,
) {
    const body = await insertPatch(dataset);
    await fetch(container_iri + ".meta", {
        method: "PATCH",
        body: body,
        headers: {
            "Content-Type": "application/sparql-update",
        },
    }).then((res) => {
        if (!res.ok) {
            throw new Error(`failed to patch ${container_iri}`);
        }
    });
}

export async function deleteContainerResource(fetch: Fetch, containerIRI: string): Promise<void> {
    const { ok } = await fetch(containerIRI, {
        method: "DELETE",
    });

    if (!ok) {
        throw new Error(`Failed to delete data at ${containerIRI}`);
    }
}

export function readResource(fetch: Fetch, url: string): Promise<string> {
    return fetch(url).then((res) => {
        if (res.ok) return res.text();
        throw new ReadResourceError("Couldn't read the resource at " + url);
    });
}

export function readParseResource(fetch: Fetch, url: string): Promise<ParserResult> {
    return fetch(url)
        .then((res) => res.text())
        .then((res) => parseTurtle(res, url));
}

class InsertResourceError extends Error {
    constructor(public message: string) {
        super(message);
    }
}

class ReadResourceError extends Error {
    constructor(public message: string) {
        super(message);
    }
}
