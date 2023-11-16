export abstract class Agent {
    webID: string;

    constructor(webID: string) {
        this.webID = webID;
    }

    getWebID(): string {
        return this.webID;
    }
}

export class SocialAgent extends Agent {
    constructor(webID: string) {
        super(webID);
    }
}

export class ApplicationAgent extends Agent {
    constructor(webID: string) {
        super(webID);
    }
}