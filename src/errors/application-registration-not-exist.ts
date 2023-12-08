export class NoApplicationRegistrationError extends Error {constructor(webId?: string) {
    super(`No Application Registration for WebID: ${webId}`);
}}
