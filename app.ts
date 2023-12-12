import express from "express";
import cookieSession from "cookie-session";
import {
    getSessionFromStorage,
    getSessionIdFromStorageAll,
    Session,
} from "@inrupt/solid-client-authn-node";
import { config } from "dotenv";
import * as fs from "fs";
import * as https from "https";
import { AuthorizationAgent } from "./src/authorization-agent";
import { authorizationAgentUrl2webId, webId2AuthorizationAgentUrl } from "./src/utils/uri-convert";
import { AccessApprovalHandler } from "./src/handlers/AccessApprovalHandler";
import {
    AccessNeedGroup,
    ApplicationAgent,
    ApplicationProfileDocument, ApplicationRegistration,
    deleteContainerResource,
    getResource,
    insertTurtleResource,
    readResource,
    serializeTurtle,
    SocialAgentProfileDocument
} from "solid-interoperability";
import { DataAccessScope, DataAccessScopeAll } from "./src/application/data-access-scope";
import Link from "http-link-header";
import path from "path";
import { RedisSolidStorage } from "./src/redis/redis-storage";
import { Store, DataFactory } from "n3";
import { INTEROP, TYPE_A } from "./src/namespace";
import { Approval } from "./src/application/approval";

const { namedNode } = DataFactory

config();
const app = express();
export const port = parseInt(process.env.PORT || "3000");
export const address = process.env.ADDRESS || "localhost";
const hostname = "0.0.0.0";
const useHttps = process.env?.HTTPS == "TRUE";
export const protocol = `http${useHttps ? "s" : ""}://`;
const privateKey = process.env.PRIVATEKEY ?? "";
const certificate = process.env.CERTIFICATE ?? "";

const oidcIssuers = ["https://login.inrupt.com", "https://solidweb.me", "https://solidcommunity.net", "http://localhost:3000/"]

type WebId = string;
const cache = new Map<WebId, AuthorizationAgent>();
// The following snippet ensures that the server identifies each user's session
// with a cookie using an express-specific mechanism
app.use(
    cookieSession({
        name: "session",
        // These keys are required by cookie-session to sign the cookies.
        keys: [
            "Required, but value not relevant for this demo - key1",
            "Required, but value not relevant for this demo - key2",
        ],
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }),
);

if (useHttps) {
    const options = {
        key: fs.readFileSync(privateKey),
        cert: fs.readFileSync(certificate),
    };

    const server = https.createServer(options, app);

    server.listen(port, hostname, () => {
        console.log(`Server running at https://${address}:${port}`);
    });
} else {
    app.listen(port, hostname, () => {
        console.log(`Server running at http://${address}:${port}`);
    });
}

const authorizationRouter = express.Router()
app.use('/agents', authorizationRouter);

authorizationRouter.get("/new", async (req, res) => {
    // 1. Create a new Session
    const session = new Session({ storage: new RedisSolidStorage() });
    req.session!.sessionId = session.info.sessionId;
    const redirectToSolidIdentityProvider = (url: string) => {
        // Since we use Express in this example, we can call `res.redirect` to send the user to the
        // given URL, but the specific method of redirection depend on your app's particular setup.
        // For example, if you are writing a command line app, this might simply display a prompt for
        // the user to visit the given URL in their browser.
        res.redirect(url);
    };
    // 2. Start the login process; redirect handler will handle sending the user to their
    //    Solid Identity Provider.
    await session.login({
        // After login, the Solid Identity Provider will send the user back to the following
        // URL, with the data necessary to complete the authentication process
        // appended as query parameters:
        redirectUrl: `${protocol}${address}:${port}/agents/new/callback`,
        // Set to the user's Solid Identity Provider; e.g., "https://login.inrupt.com"
        oidcIssuer: oidcIssuers[3],
        // Pick an application name that will be shown when asked
        // to approve the application's access to the requested data.
        clientName: "Authorization Agent",
        handleRedirect: redirectToSolidIdentityProvider,
    });
})

/**
 * Gets the existing authorization agents if they exist in the cache when starting the service.
 */
async function getAuthorizationAgentsFromCache() {
    try {
        const sessionIds = await getSessionIdFromStorageAll(new RedisSolidStorage());

        for (const id of sessionIds) {
            const session = await getSessionFromStorage(id, new RedisSolidStorage());

            if (!session)
                continue;

            const webId = session.info.webId!;
            const authorizationAgent = await AuthorizationAgent.new(session)
            cache.set(webId, authorizationAgent);
        }
    } catch (error) {
        console.error("Error in getAuthorizationAgentsFromCache:", error);
    }
}

/**
 * Used to remove the previous session
 * @param webId Id for the Application
 * @param expectSessionId The session id
 */
async function removePreviousSession(webId: string, expectSessionId: string) {
    try {
        const sessionIds = await getSessionIdFromStorageAll(new RedisSolidStorage());

        for (const id of sessionIds.filter(id => id !== expectSessionId)) {
            const session = await getSessionFromStorage(id, new RedisSolidStorage());

            if (session && session.info.webId === webId)
                await session.logout();
        }
    } catch (error) {
        console.error("Error in removePreviousSession:", error);
    }
}


authorizationRouter.get("/new/callback", async (req, res) => {
    try {
        // 3. If the user is sent back to the `redirectUrl` provided in step 2,
        //    it means that the login has been initiated and can be completed. In
        //    particular, initiating the login stores the session in storage,
        //    which means it can be retrieved as follows.
        const session = await getSessionFromStorage(req.session!.sessionId, new RedisSolidStorage());

        if (!session)
            return res.sendStatus(403).send();

        // 4. With your session back from storage, you are now able to
        //    complete the login process using the data appended to it as query
        //    parameters in req.url by the Solid Identity Provider:
        await session.handleIncomingRedirect(
            `${req.protocol}://${req.get("host")}${req.originalUrl}`
        );

        const webId = session.info.webId!;
        await removePreviousSession(webId, req.session!.sessionId);

        let authAgent = cache.get(webId);

        if (!authAgent) {
            const agentURI = webId2AuthorizationAgentUrl(webId);
            const profileDocument: SocialAgentProfileDocument = await getResource(SocialAgentProfileDocument, session.fetch, webId);

            if (!profileDocument.hasAuthorizationAgent(agentURI))
                await profileDocument.addHasAuthorizationAgent(agentURI);

            authAgent = await AuthorizationAgent.new(session);
            cache.set(webId, authAgent);
        } else
            authAgent.session = session;

        if (session!.info.isLoggedIn)
            return res.send(`<p>Logged in with the WebID: ${webId}. <a href="localhost:3001/agents/new"></p>`);
    } catch (error) {
        console.error("Error in authorizationRouter callback:", error);
        return res.status(500).send("Internal Server Error");
    }
});


/*
The endpoint for requesting if an Application has access to the Pod.
*/
authorizationRouter.get("/:webId", async (req, res) => {
    console.log("Getting Auth agent")
    let authorizationAgent: AuthorizationAgent
    try {
        const agent = cache.get(authorizationAgentUrl2webId(req.params.webId))
        if (!agent) {
            console.error("Authorization Agent could not be retrieved from cache.");
            res.status(400).send("Authorization Agent could not be retrieved from cache.");
            return
        }
        authorizationAgent = agent
    } catch (e)
    {
        console.error(e)
        res.status(500).send("Authorization Agent could not be retrieved from cache.")
        return
    }

    if (req.method == "HEAD") {
        if (typeof(req.query.client_id) != "string") {
            res.status(400).send('Bad Request: Missing "client_id" parameter');
            return
        }

        const clientId: string = decodeURIComponent(req.query.client_id as string)

        if (clientId == undefined) {
            console.error(`Client id was ${clientId}.`)
            res.status(400).send("Wrong Client ID.")
            return
        }

        let registration: ApplicationRegistration
        try{
            registration = await authorizationAgent.findAgentRegistrationInPod(clientId) as ApplicationRegistration
        } catch (e) {
            console.error(`Error getting Application Registration:\n${e}`)
            res.status(500).send("Error getting Application Registration")
            return
        }
        try {
            res.header('Link', `<${clientId}>; anchor="${registration.uri}"; rel="https://www.w3.org/ns/solid/interop#registeredAgent"`)
            return res.status(200).send();
        } catch (error) {
            console.error(`Encountered error while responding to request:\n${error}`)
            res.status(400).send("Could not respond to request. Client: " + req.params.webId);
            return
        }
    }
    else {
        const authorizationAgentId = `${protocol}${address}:${port}/agents/${req.params.webId}`
        const subject = namedNode(authorizationAgentId)
        const store = new Store()
        store.addQuad(subject, namedNode(TYPE_A), namedNode(INTEROP + "AuthorizationAgent"))
        store.addQuad(subject, namedNode(INTEROP + "hasAuthorizationRedirectEndpoint"), namedNode(authorizationAgentId + "/wants-access"))
        res.setHeader('content-type', 'text/turtle');
        return res.status(200).send(await serializeTurtle(store, {}));
    }
})

/*
The endpoint for the Application wanting access to a Pod
*/
authorizationRouter.post("/:webId/wants-access", async (req, res) => {
    if (typeof(req.query.client_id) != "string") {
        res.status(400).send('Bad Request: Missing "client_id" parameter');
        return
    }

    const clientId: string = decodeURIComponent(req.query.client_id as string);
    console.log(`Trying to authorize: ${clientId}`)

    let authorizationAgent: AuthorizationAgent;
    try {
        const agent = cache.get(authorizationAgentUrl2webId(req.params.webId))
        if (agent == undefined){
            res.status(403).send("Authorization Agent not found. Are you logged in?")
            return
        }
        authorizationAgent = agent
    } catch (e) {
        console.error("Error getting Authorization Agent:\n" + e)
        res.status(500).send("Could not get Authorization Agent.")
        return
    }

    const accessApprovalHandler = new AccessApprovalHandler();

    let approved;
    try {
        approved = accessApprovalHandler.requestAccessApproval()
    } catch (e) {
        console.error("Error getting Access Approval:\n" + e)
        res.status(500).send("Could not approve request.")
        return
    }

    if (!approved){
        res.status(403).send('Your request got rejected');
        return
    }

    const fetch = authorizationAgent.session.fetch;

    let applicationProfileDocument: ApplicationProfileDocument;
    try {
        applicationProfileDocument = await getResource(ApplicationProfileDocument, fetch, clientId)
    } catch (e) {
        console.error("Error getting Application Profile Document:\n" + e)
        res.status(500).send("Could not get Application Profile Document.")
        return
    }

    let accesNeedGroups: AccessNeedGroup[];
    try {
        accesNeedGroups = await applicationProfileDocument.getHasAccessNeedGroup();
        console.log(accesNeedGroups);
    } catch (e) {
        console.error("Error getting Access Need Groups:\n" + e)
        res.status(500).send("Could not get Access Need Group from Application Profile Document.");
        return
    }
    if (accesNeedGroups.length < 1)
    {
        res.status(500).send("No Access Need Groups registered.")
        console.error("No Access Need Groups registered.")
        return
    }
    const access = new Map<AccessNeedGroup, DataAccessScope[]>();

    for (const accessNeedGroup of accesNeedGroups) {
        const accessNeeds = await accessNeedGroup.getHasAccessNeed();
        const dataAccessScopes = accessNeeds.map(accessNeed => new DataAccessScopeAll(accessNeed));
        access.set(accessNeedGroup, dataAccessScopes);
    }

    let approvalStatus: Approval;
    try{
        approvalStatus =  accessApprovalHandler.getApprovalStatus(new ApplicationAgent(clientId), access)
    } catch (e) {
        console.error("Error getting Approval Status:\n" + e)
        res.status(500).send("Could not get approval status.");
        return
    }

    try {
        await authorizationAgent.insertNewAgentToPod(approvalStatus)
    } catch (e) {
        console.error("Error inserting into pod:\n" + e)
        res.status(500).send("Could not insert Agent into Pod.");
        return
    }

    res.status(202).send("Access was granted.")
});

const podsRouter = express.Router()
app.use('/pods', podsRouter);

/*
Endpoint for inserting data into the Pod
*/
podsRouter.put("/:dataId/:webId", async (req, res) => {
    const dataId: string = req.params.dataId;
    const authorization: string = req.headers["Authorization"] as string;
    const link: string = req.headers["Link"] as string;
    const authorizationAgent: AuthorizationAgent | undefined = cache.get(req.params.webId);

    if (!authorization || !link)
        return res.status(400).json({ error: "Both Authorization and Link headers are required." });

    if (!authorizationAgent)
        return res.status(401).json({ error: "Invalid or expired authorization agent." });

    try {
        const linkValue = Link.parse(link);

        if (linkValue.refs.length === 1) {
            const dataInstanceIRI: string = linkValue.refs[0].uri + '/' + dataId;
            await insertTurtleResource(authorizationAgent.session.fetch, dataInstanceIRI, req.body);
            res.status(200).json({ success: true });
        } else {
            res.status(400).json({ error: "Only one Link header is allowed." });
        }
    } catch (error) {
        console.error("Error processing the request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/*
Endpoint for getting data from the Pod
*/
podsRouter.get("/:dataIRI/:webId", async (req, res) => {
    const dataIRI: string = req.params.dataIRI;
    const authorizationAgent: AuthorizationAgent | undefined = cache.get(req.params.webId);
    if (!authorizationAgent)
        return res.status(400).json({ error: "Bad request" });

    try {
        const data = await readResource(authorizationAgent.session.fetch, dataIRI);
        res.status(200).send(data);
    } catch (error) {
        console.error("Error retrieving data from the Pod:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/*
Endpoint for deleting data from the Pod
*/
podsRouter.delete("/:dataIRI/:webId", async (req, res) => {
    const dataId: string = req.params.dataIRI;
    const authorization: string = req.headers["Authorization"] as string;
    const link: string = req.headers["Link"] as string;
    const authorizationAgent: AuthorizationAgent | undefined = cache.get(req.params.webId);

    if (!authorization || !link)
        return res.status(400).json({ error: "Both Authorization and Link headers are required." });

    if (!authorizationAgent)
        return res.status(401).json({ error: "Invalid or expired authorization agent." });

    try {
        const linkValue = Link.parse(link);

        if (linkValue.refs.length === 1) {
            const dataInstanceIRI: string = linkValue.refs[0].uri + '/' + dataId;
            await deleteContainerResource(authorizationAgent.session.fetch, dataInstanceIRI);
            res.status(200).json({ success: true });
        } else {
            res.status(400).json({ error: "Only one Link header is allowed." });
        }
    } catch (error) {
        console.error("Error processing the delete request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const projectronRouter = express.Router()
app.use('/projectron', projectronRouter);

projectronRouter.get("/", async (_req, res) => {
    const options = {
        root: path.join(__dirname, "../")
    };
    return res.status(200).sendFile("test/projectron.ttl", options);
});

export { app };

getAuthorizationAgentsFromCache();