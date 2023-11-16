import { address, port, protocol } from "../../app";

function encodeWebId(webId: string): string {
    return Buffer.from(webId).toString('base64');
}

function decodeWebId(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('ascii');
}

export function webId2AuthorizationAgentUrl(webId: string): string {
    const encoded = encodeWebId(webId);
    return `${protocol}${address}:${port}/agents/${encoded}`;
}

export function authorizationAgentUrl2webId(agentUrl: string): string {
    const encoded = agentUrl.split('/').at(-1)!;
    return decodeWebId(encoded);
}